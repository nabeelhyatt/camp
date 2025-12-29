/**
 * Convex Chat API
 *
 * Provides TanStack React Query-compatible hooks for chat operations
 * using the Convex backend. These hooks maintain the same interface as
 * the SQLite-based ChatAPI for seamless switching.
 */

import { useQuery, useMutation } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@convex/_generated/api";
import { useWorkspaceContext } from "./useWorkspaceHooks";
import {
    convexChatToChat,
    convexChatsToChats,
    stringToConvexId,
} from "./convexTypes";
import { chatQueries } from "@core/chorus/api/ChatAPI";

// Re-export for cache compatibility
export { chatQueries };

// Chat query keys
export const chatKeys = {
    all: () => ["chats"] as const,
    allDetails: () => [...chatKeys.all(), "detail"] as const,
};

// ============================================================
// Queries
// ============================================================

/**
 * Hook to list all chats in the current workspace
 */
export function useChatsQueryConvex(options?: { projectId?: string }) {
    const {
        clerkId,
        workspaceId,
        isLoading: contextLoading,
    } = useWorkspaceContext();

    const result = useQuery(
        api.chats.list,
        clerkId && workspaceId
            ? {
                  clerkId,
                  workspaceId,
                  projectId: options?.projectId
                      ? stringToConvexId<"projects">(options.projectId)
                      : undefined,
              }
            : "skip",
    );

    const data = result ? convexChatsToChats(result) : undefined;

    return {
        data,
        isLoading: contextLoading || result === undefined,
        isError: false,
        error: null,
        isStale: false,
        isFetching: result === undefined,
    };
}

/**
 * Hook to get a single chat by ID
 */
export function useChatQueryConvex(chatId: string | undefined) {
    const { clerkId } = useWorkspaceContext();

    const result = useQuery(
        api.chats.get,
        clerkId && chatId
            ? { clerkId, chatId: stringToConvexId<"chats">(chatId) }
            : "skip",
    );

    const data = result ? convexChatToChat(result) : undefined;

    return {
        data,
        isLoading: result === undefined && !!chatId,
        isError: false,
        error: null,
    };
}

/**
 * Hook to get ungrouped chats (not in any project)
 */
export function useUngroupedChatsQueryConvex() {
    const {
        clerkId,
        workspaceId,
        isLoading: contextLoading,
    } = useWorkspaceContext();

    const result = useQuery(
        api.chats.listUngrouped,
        clerkId && workspaceId ? { clerkId, workspaceId } : "skip",
    );

    const data = result ? convexChatsToChats(result) : undefined;

    return {
        data,
        isLoading: contextLoading || result === undefined,
        isError: false,
        error: null,
    };
}

/**
 * Hook to get user's private forks
 */
export function usePrivateForksQueryConvex() {
    const {
        clerkId,
        workspaceId,
        isLoading: contextLoading,
    } = useWorkspaceContext();

    const result = useQuery(
        api.chats.listPrivateForks,
        clerkId && workspaceId ? { clerkId, workspaceId } : "skip",
    );

    // Transform and include parent chat info
    const data = result
        ? result.map((fork) => ({
              ...convexChatToChat(fork),
              parentChat: fork.parentChat
                  ? {
                        id: fork.parentChat.id as unknown as string,
                        title: fork.parentChat.title,
                    }
                  : undefined,
          }))
        : undefined;

    return {
        data,
        isLoading: contextLoading || result === undefined,
        isError: false,
        error: null,
    };
}

// ============================================================
// Mutations
// ============================================================

/**
 * Hook to create a new chat
 */
export function useCreateChatConvex() {
    const { clerkId, workspaceId } = useWorkspaceContext();
    const createChat = useMutation(api.chats.create);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    return {
        mutateAsync: async (options?: {
            projectId?: string;
            title?: string;
            isAmbient?: boolean;
            navigateToChat?: boolean;
        }) => {
            if (!clerkId || !workspaceId) {
                throw new Error("Not authenticated or no active workspace");
            }

            const chatId = await createChat({
                clerkId,
                workspaceId,
                projectId: options?.projectId
                    ? stringToConvexId<"projects">(options.projectId)
                    : undefined,
                title: options?.title,
                isAmbient: options?.isAmbient,
            });

            void queryClient.invalidateQueries({ queryKey: chatKeys.all() });

            // Navigate if requested (default true for non-ambient)
            const shouldNavigate =
                options?.navigateToChat ?? !options?.isAmbient;
            if (shouldNavigate) {
                navigate(`/chats/${chatId}`);
            }

            return chatId as unknown as string;
        },
        isLoading: false,
    };
}

/**
 * Hook to rename a chat
 */
export function useRenameChatConvex() {
    const { clerkId } = useWorkspaceContext();
    const updateChat = useMutation(api.chats.update);
    const queryClient = useQueryClient();

    return {
        mutateAsync: async (args: { chatId: string; newTitle: string }) => {
            if (!clerkId) {
                throw new Error("Not authenticated");
            }

            await updateChat({
                clerkId,
                chatId: stringToConvexId<"chats">(args.chatId),
                title: args.newTitle,
            });

            void queryClient.invalidateQueries({ queryKey: chatKeys.all() });
        },
        isLoading: false,
    };
}

/**
 * Hook to move a chat to a different project
 */
export function useSetChatProjectConvex() {
    const { clerkId } = useWorkspaceContext();
    const updateChat = useMutation(api.chats.update);
    const queryClient = useQueryClient();

    return {
        mutateAsync: async (args: { chatId: string; projectId: string }) => {
            if (!clerkId) {
                throw new Error("Not authenticated");
            }

            await updateChat({
                clerkId,
                chatId: stringToConvexId<"chats">(args.chatId),
                projectId: args.projectId
                    ? stringToConvexId<"projects">(args.projectId)
                    : undefined,
            });

            void queryClient.invalidateQueries({ queryKey: chatKeys.all() });
        },
        isLoading: false,
    };
}

/**
 * Hook to delete a chat
 */
export function useDeleteChatConvex() {
    const { clerkId } = useWorkspaceContext();
    const removeChat = useMutation(api.chats.remove);
    const queryClient = useQueryClient();

    return {
        mutateAsync: async (args: {
            chatId: string;
            confirmCascade?: boolean;
        }) => {
            if (!clerkId) {
                throw new Error("Not authenticated");
            }

            const result = await removeChat({
                clerkId,
                chatId: stringToConvexId<"chats">(args.chatId),
                confirmCascade: args.confirmCascade,
            });

            // If cascade confirmation is required, return the result
            if (
                "requiresConfirmation" in result &&
                result.requiresConfirmation
            ) {
                return result;
            }

            void queryClient.invalidateQueries({ queryKey: chatKeys.all() });
            return result;
        },
        isLoading: false,
    };
}

/**
 * Hook to create a private fork from a team chat
 */
export function useCreatePrivateForkConvex() {
    const { clerkId } = useWorkspaceContext();
    const createFork = useMutation(api.chats.createPrivateFork);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    return {
        mutateAsync: async (args: {
            parentChatId: string;
            forkFromMessageId?: string;
            title?: string;
            navigateToChat?: boolean;
        }) => {
            if (!clerkId) {
                throw new Error("Not authenticated");
            }

            const chatId = await createFork({
                clerkId,
                parentChatId: stringToConvexId<"chats">(args.parentChatId),
                forkFromMessageId: args.forkFromMessageId
                    ? stringToConvexId<"messages">(args.forkFromMessageId)
                    : undefined,
                title: args.title,
            });

            void queryClient.invalidateQueries({ queryKey: chatKeys.all() });

            if (args.navigateToChat !== false) {
                navigate(`/chats/${chatId}`);
            }

            return chatId as unknown as string;
        },
        isLoading: false,
    };
}

/**
 * Hook to publish a summary from a private fork to the parent chat
 */
export function usePublishSummaryConvex() {
    const { clerkId } = useWorkspaceContext();
    const publishSummary = useMutation(api.chats.publishSummary);
    const queryClient = useQueryClient();

    return {
        mutateAsync: async (args: { chatId: string; summary: string }) => {
            if (!clerkId) {
                throw new Error("Not authenticated");
            }

            const result = await publishSummary({
                clerkId,
                chatId: stringToConvexId<"chats">(args.chatId),
                summary: args.summary,
            });

            void queryClient.invalidateQueries({ queryKey: chatKeys.all() });

            return result;
        },
        isLoading: false,
    };
}
