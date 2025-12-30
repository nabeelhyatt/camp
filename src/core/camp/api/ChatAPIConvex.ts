/**
 * Convex Chat API
 *
 * Provides TanStack React Query-compatible hooks for chat operations
 * using the Convex backend. These hooks maintain the same interface as
 * the SQLite-based ChatAPI for seamless switching.
 */

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@convex/_generated/api";
import { useWorkspaceContext } from "./useWorkspaceHooks";
import {
    convexChatToChat,
    convexChatsToChats,
    stringToConvexId,
    isSentinelProjectId,
    isQuickChatByProjectId,
    stringToConvexIdStrict,
    isSQLiteId,
} from "./convexTypes";
import { chatQueries } from "@core/chorus/api/ChatAPI";
import { campConfig } from "@core/campConfig";

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

    // Skip Convex queries when not using Convex data layer
    const shouldSkip = !campConfig.useConvexData;

    // Handle sentinel project IDs - only pass real Convex IDs
    const projectIdForQuery =
        options?.projectId && !isSentinelProjectId(options.projectId)
            ? stringToConvexId<"projects">(options.projectId)
            : undefined;

    const result = useQuery(
        api.chats.list,
        !shouldSkip && clerkId && workspaceId
            ? {
                  clerkId,
                  workspaceId,
                  projectId: projectIdForQuery,
                  includeAmbient: true, // Include quick/ambient chats
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

    // Skip Convex queries when not using Convex data layer
    const shouldSkip = !campConfig.useConvexData;

    // Also skip if this is a SQLite ID (existing local chat) - can't query Convex with it
    const isSqliteChat = isSQLiteId(chatId);

    const result = useQuery(
        api.chats.get,
        !shouldSkip && !isSqliteChat && clerkId && chatId
            ? { clerkId, chatId: stringToConvexIdStrict<"chats">(chatId) }
            : "skip",
    );

    const data = result ? convexChatToChat(result) : undefined;
    const isLoading = result === undefined && !!chatId && !isSqliteChat;

    return {
        data,
        isLoading,
        isError: false,
        error: null,
        // TanStack Query compatibility properties
        isSuccess: !isLoading && data !== undefined,
        status: isLoading ? "pending" : data !== undefined ? "success" : "idle",
        // Flag to indicate this is a SQLite chat that needs local lookup
        isSQLiteChat: isSqliteChat,
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

    // Skip Convex queries when not using Convex data layer
    const shouldSkip = !campConfig.useConvexData;

    const result = useQuery(
        api.chats.listUngrouped,
        !shouldSkip && clerkId && workspaceId
            ? { clerkId, workspaceId, includeAmbient: true }
            : "skip",
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

    // Skip Convex queries when not using Convex data layer
    const shouldSkip = !campConfig.useConvexData;

    const result = useQuery(
        api.chats.listPrivateForks,
        !shouldSkip && clerkId && workspaceId
            ? { clerkId, workspaceId }
            : "skip",
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
 * Get or create a new chat in a project (Convex version)
 * Unlike SQLite version, we don't track "is_new_chat" state - just create a fresh chat
 * This is the Convex equivalent of useGetOrCreateNewChat from SQLite
 *
 * IMPORTANT: Must properly track isPending/isIdle state to prevent infinite loops
 * when components check isIdle before calling mutate (e.g., Home.tsx)
 */
export function useGetOrCreateNewChatConvex() {
    const { clerkId, workspaceId } = useWorkspaceContext();
    const createChat = useMutation(api.chats.create);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Track mutation state using refs to avoid re-render cascades
    // Use state only for the values that need to trigger re-renders
    const [status, setStatus] = useState<"idle" | "pending" | "done">("idle");
    const isPendingRef = useRef(false);

    const mutateAsync = useCallback(
        async ({ projectId }: { projectId: string }) => {
            // Prevent duplicate calls while pending (check ref, not state)
            if (isPendingRef.current) {
                return;
            }

            if (!clerkId || !workspaceId) {
                throw new Error("Not authenticated or no active workspace");
            }

            isPendingRef.current = true;
            setStatus("pending");

            try {
                // Handle sentinel project IDs from SQLite ("default" = no project)
                const convexProjectId =
                    projectId && !isSentinelProjectId(projectId)
                        ? stringToConvexId<"projects">(projectId)
                        : undefined;

                const chatId = await createChat({
                    clerkId,
                    workspaceId,
                    projectId: convexProjectId,
                    isAmbient: false,
                });

                void queryClient.invalidateQueries({
                    queryKey: chatKeys.all(),
                });
                navigate(`/chat/${chatId}`);

                return chatId as unknown as string;
            } finally {
                isPendingRef.current = false;
                setStatus("done");
            }
        },
        // Note: Do NOT include status in deps - we use ref to check pending state
        [clerkId, workspaceId, createChat, queryClient, navigate],
    );

    const mutate = useCallback(
        ({ projectId }: { projectId: string }) => {
            void mutateAsync({ projectId });
        },
        [mutateAsync],
    );

    return {
        mutateAsync,
        mutate,
        isLoading: status === "pending",
        isPending: status === "pending",
        // isIdle means never called yet - only true when status is still "idle"
        isIdle: status === "idle",
    };
}

/**
 * Get or create a new quick/ambient chat (Convex version)
 *
 * This is the Convex equivalent of useGetOrCreateNewQuickChat from SQLite.
 * We always create a fresh ambient chat for now.
 */
export function useGetOrCreateNewQuickChatConvex() {
    const { clerkId, workspaceId } = useWorkspaceContext();
    const createChat = useMutation(api.chats.create);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const [status, setStatus] = useState<"idle" | "pending" | "done">("idle");

    const mutateAsync = useCallback(async () => {
        if (status === "pending") {
            return;
        }

        if (!clerkId || !workspaceId) {
            throw new Error("Not authenticated or no active workspace");
        }

        setStatus("pending");

        try {
            const chatId = await createChat({
                clerkId,
                workspaceId,
                isAmbient: true,
            });

            void queryClient.invalidateQueries({ queryKey: chatKeys.all() });
            navigate(`/chat/${chatId}`);

            return String(chatId);
        } finally {
            setStatus("done");
        }
    }, [clerkId, workspaceId, createChat, queryClient, navigate, status]);

    const mutate = useCallback(() => {
        void mutateAsync();
    }, [mutateAsync]);

    return {
        mutateAsync,
        mutate,
        isLoading: status === "pending",
        isPending: status === "pending",
        isIdle: status === "idle",
    };
}

/**
 * Hook to create a new chat
 */
export function useCreateChatConvex() {
    const { clerkId, workspaceId } = useWorkspaceContext();
    const createChat = useMutation(api.chats.create);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const mutateAsync = async (options?: {
        projectId?: string;
        title?: string;
        isAmbient?: boolean;
        navigateToChat?: boolean;
    }) => {
        if (!clerkId || !workspaceId) {
            throw new Error("Not authenticated or no active workspace");
        }

        // Handle sentinel project IDs from SQLite
        // "default" means no project, "quick-chat" means ambient
        const isAmbient =
            options?.isAmbient || isQuickChatByProjectId(options?.projectId);
        const projectId =
            options?.projectId && !isSentinelProjectId(options.projectId)
                ? stringToConvexId<"projects">(options.projectId)
                : undefined;

        const chatId = await createChat({
            clerkId,
            workspaceId,
            projectId,
            title: options?.title,
            isAmbient,
        });

        void queryClient.invalidateQueries({ queryKey: chatKeys.all() });

        // Navigate if requested (default true for non-ambient)
        const shouldNavigate = options?.navigateToChat ?? !options?.isAmbient;
        if (shouldNavigate) {
            navigate(`/chat/${chatId}`);
        }

        return chatId as unknown as string;
    };

    return {
        mutateAsync,
        mutate: (options?: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(options),
        isLoading: false,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Hook to rename a chat
 */
export function useRenameChatConvex() {
    const { clerkId } = useWorkspaceContext();
    const updateChat = useMutation(api.chats.update);
    const queryClient = useQueryClient();

    const mutateAsync = async (args: { chatId: string; newTitle: string }) => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }

        await updateChat({
            clerkId,
            chatId: stringToConvexIdStrict<"chats">(args.chatId),
            title: args.newTitle,
        });

        void queryClient.invalidateQueries({ queryKey: chatKeys.all() });
    };

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isLoading: false,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Hook to move a chat to a different project
 */
export function useSetChatProjectConvex() {
    const { clerkId } = useWorkspaceContext();
    const updateChat = useMutation(api.chats.update);
    const queryClient = useQueryClient();

    const mutateAsync = async (args: { chatId: string; projectId: string }) => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }

        // Handle sentinel project IDs - "default" means remove from project
        const projectId =
            args.projectId && !isSentinelProjectId(args.projectId)
                ? stringToConvexId<"projects">(args.projectId)
                : undefined;

        await updateChat({
            clerkId,
            chatId: stringToConvexIdStrict<"chats">(args.chatId),
            projectId,
        });

        void queryClient.invalidateQueries({ queryKey: chatKeys.all() });
    };

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isLoading: false,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Hook to delete a chat
 */
export function useDeleteChatConvex() {
    const { clerkId } = useWorkspaceContext();
    const removeChat = useMutation(api.chats.remove);
    const queryClient = useQueryClient();

    const mutateAsync = async (args: {
        chatId: string;
        confirmCascade?: boolean;
    }) => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }

        const result = await removeChat({
            clerkId,
            chatId: stringToConvexIdStrict<"chats">(args.chatId),
            confirmCascade: args.confirmCascade,
        });

        // If cascade confirmation is required, return the result
        if ("requiresConfirmation" in result && result.requiresConfirmation) {
            return result;
        }

        void queryClient.invalidateQueries({ queryKey: chatKeys.all() });
        return result;
    };

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isLoading: false,
        isPending: false,
        isIdle: true,
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

    const mutateAsync = async (args: {
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
            parentChatId: stringToConvexIdStrict<"chats">(args.parentChatId),
            forkFromMessageId: args.forkFromMessageId
                ? stringToConvexIdStrict<"messages">(args.forkFromMessageId)
                : undefined,
            title: args.title,
        });

        void queryClient.invalidateQueries({ queryKey: chatKeys.all() });

        if (args.navigateToChat !== false) {
            navigate(`/chat/${chatId}`);
        }

        return chatId as unknown as string;
    };

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isLoading: false,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Hook to publish a summary from a private fork to the parent chat
 */
export function usePublishSummaryConvex() {
    const { clerkId } = useWorkspaceContext();
    const publishSummary = useMutation(api.chats.publishSummary);
    const queryClient = useQueryClient();

    const mutateAsync = async (args: { chatId: string; summary: string }) => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }

        const result = await publishSummary({
            clerkId,
            chatId: stringToConvexIdStrict<"chats">(args.chatId),
            summary: args.summary,
        });

        void queryClient.invalidateQueries({ queryKey: chatKeys.all() });

        return result;
    };

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isLoading: false,
        isPending: false,
        isIdle: true,
    };
}
