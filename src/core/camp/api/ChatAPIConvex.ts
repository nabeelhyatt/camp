/**
 * Convex Chat API
 *
 * Provides TanStack React Query-compatible hooks for chat operations
 * using the Convex backend. These hooks maintain the same interface as
 * the SQLite-based ChatAPI for seamless switching.
 */

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@convex/_generated/api";
import { useWorkspaceContext } from "./useWorkspaceHooks";
import {
    convexChatToChat,
    convexChatToConvexChat,
    convexChatsToChats,
    convexChatsWithCreatorsToChatsWithCreators,
    stringToConvexId,
    isSentinelProjectId,
    isQuickChatByProjectId,
    stringToConvexIdStrict,
    isSQLiteId,
    type ConvexChat,
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
 * Returns ConvexChat which includes multiplayer fields (visibility, forkDepth, etc.)
 */
export function useChatQueryConvex(chatId: string | undefined): {
    data: ConvexChat | undefined;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    isSuccess: boolean;
    status: "pending" | "success" | "idle" | "error";
    isSQLiteChat: boolean;
} {
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

    const isNotFound = result === null;
    // Use convexChatToConvexChat to include multiplayer fields (visibility, forkDepth, etc.)
    const data = result ? convexChatToConvexChat(result) : undefined;
    const isLoading = result === undefined && !!chatId && !isSqliteChat;
    const isError = isNotFound;
    const error = isNotFound ? new Error("Chat not found") : null;
    const status: "pending" | "success" | "idle" | "error" = isLoading
        ? "pending"
        : isError
          ? "error"
          : data !== undefined
            ? "success"
            : "idle";

    return {
        data,
        isLoading,
        isError,
        error,
        // TanStack Query compatibility properties
        isSuccess: status === "success",
        status,
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
 * Hook to list chats with creator information for attribution
 * Used in list views like Team Projects page
 */
export function useChatsWithCreatorsQueryConvex() {
    const {
        clerkId,
        workspaceId,
        isLoading: contextLoading,
    } = useWorkspaceContext();

    // Skip Convex queries when not using Convex data layer
    const shouldSkip = !campConfig.useConvexData;

    const result = useQuery(
        api.chats.listWithCreators,
        !shouldSkip && clerkId && workspaceId
            ? { clerkId, workspaceId }
            : "skip",
    );

    const data = result
        ? convexChatsWithCreatorsToChatsWithCreators(result)
        : undefined;

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
                        id: String(fork.parentChat.id),
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
                // Context not ready yet - this can happen during initial load
                // Don't throw, just log and return. The component will retry when ready.
                console.log(
                    "[useGetOrCreateNewChatConvex] Waiting for auth context...",
                );
                return;
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

                return String(chatId);
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
            // Context not ready yet - this can happen during initial load
            // Don't throw, just log and return. The component will retry when ready.
            console.log(
                "[useGetOrCreateNewQuickChatConvex] Waiting for auth context...",
            );
            return;
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
        // Use the computed isAmbient to keep navigation consistent with creation
        const shouldNavigate = options?.navigateToChat ?? !isAmbient;
        if (shouldNavigate) {
            navigate(`/chat/${chatId}`);
        }

        return String(chatId);
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
 *
 * Note: Private forks are NOT cascade deleted. They remain accessible
 * with a "[Deleted]" indicator for the parent chat.
 */
export function useDeleteChatConvex() {
    const { clerkId } = useWorkspaceContext();
    const removeChat = useMutation(api.chats.remove);
    const queryClient = useQueryClient();

    const mutateAsync = async (args: { chatId: string }) => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }

        const result = await removeChat({
            clerkId,
            chatId: stringToConvexIdStrict<"chats">(args.chatId),
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
        openInSidebar?: boolean;
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
            if (args.openInSidebar) {
                // Open in RepliesDrawer sidebar (like Chorus SQLite behavior)
                navigate(`/chat/${args.parentChatId}?replyId=${chatId}`);
            } else {
                // Navigate directly to the fork
                navigate(`/chat/${chatId}`);
            }
        }

        return String(chatId);
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
 * Hook to generate a title for a chat based on its first message
 * Uses client-side simpleLLM for now (reuses existing infrastructure)
 */
export function useGenerateChatTitleConvex() {
    const { clerkId } = useWorkspaceContext();
    const updateChat = useMutation(api.chats.update);
    const convex = useConvex();
    const queryClient = useQueryClient();

    const [isPending, setIsPending] = useState(false);

    const mutateAsync = useCallback(
        async (args: { chatId: string }) => {
            if (!clerkId) {
                console.warn(
                    "[useGenerateChatTitleConvex] No clerkId, skipping",
                );
                return { skipped: true };
            }

            setIsPending(true);

            try {
                // Guard against SQLite IDs in Convex context
                if (isSQLiteId(args.chatId)) {
                    console.warn(
                        "[useGenerateChatTitleConvex] SQLite chatId in Convex context, skipping",
                        args.chatId,
                    );
                    return { skipped: true };
                }
                const chatId = stringToConvexIdStrict<"chats">(args.chatId);

                // Check if chat already has a title
                const chat = await convex.query(api.chats.get, {
                    clerkId,
                    chatId,
                });

                if (
                    chat?.title &&
                    chat.title !== "New Chat" &&
                    chat.title !== "Untitled Chat"
                ) {
                    console.log(
                        "[useGenerateChatTitleConvex] Chat already has title, skipping",
                    );
                    return { skipped: true };
                }

                // Get messages to find user message for title generation
                const messageSets = await convex.query(
                    api.messages.listSetsWithMessages,
                    { clerkId, chatId },
                );

                if (!messageSets || messageSets.length === 0) {
                    console.log(
                        "[useGenerateChatTitleConvex] No message sets, skipping",
                    );
                    return { skipped: true };
                }

                // Find the first user message text
                let userMessageText: string | undefined;

                for (const set of messageSets) {
                    for (const msg of set.messages) {
                        if (msg.role === "user") {
                            // Combine text parts
                            const textParts = msg.parts
                                .filter((p) => p.type === "text")
                                .sort((a, b) => a.order - b.order)
                                .map((p) => p.content)
                                .join("");

                            if (textParts) {
                                userMessageText = textParts;
                                break;
                            }
                        }
                    }
                    if (userMessageText) break;
                }

                if (!userMessageText) {
                    console.log(
                        "[useGenerateChatTitleConvex] No user message found, skipping",
                    );
                    return { skipped: true };
                }

                // Dynamic import simpleLLM to avoid loading when not needed
                const { simpleLLM } = await import("@core/chorus/simpleLLM");

                const fullResponse = await simpleLLM(
                    `Based on this first message, write a 1-5 word title for the conversation. Try to put the most important words first. Format your response as <title>YOUR TITLE HERE</title>.
If there's no information in the message, just return "Untitled Chat".
<message>
${userMessageText}
</message>`,
                    {
                        model: "claude-3-5-sonnet-latest",
                        maxTokens: 100,
                    },
                );

                // Extract title from XML tags
                const match = fullResponse.match(/<title>(.*?)<\/title>/s);
                if (!match || !match[1]) {
                    console.warn(
                        "[useGenerateChatTitleConvex] No title found in response:",
                        fullResponse,
                    );
                    return { skipped: true };
                }

                const cleanTitle = match[1]
                    .trim()
                    .slice(0, 40)
                    .replace(/["']/g, "");

                if (cleanTitle) {
                    console.log(
                        "[useGenerateChatTitleConvex] Setting chat title to:",
                        cleanTitle,
                    );

                    await updateChat({
                        clerkId,
                        chatId,
                        title: cleanTitle,
                    });

                    // Invalidate cache
                    void queryClient.invalidateQueries({
                        queryKey: chatKeys.all(),
                    });
                }

                return { title: cleanTitle };
            } catch (error) {
                console.error("[useGenerateChatTitleConvex] Error:", error);
                return { skipped: true };
            } finally {
                setIsPending(false);
            }
        },
        [clerkId, convex, updateChat, queryClient],
    );

    return {
        mutateAsync,
        mutate: (args: { chatId: string }) => void mutateAsync(args),
        isPending,
        isIdle: !isPending,
        isLoading: isPending,
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

        // Invalidate chat list
        void queryClient.invalidateQueries({ queryKey: chatKeys.all() });

        // Invalidate the parent chat's message sets so the new summary appears immediately
        if (result.parentChatId) {
            void queryClient.invalidateQueries({
                queryKey: [
                    "chats",
                    String(result.parentChatId),
                    "messageSets",
                    "list",
                ],
            });
        }

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
