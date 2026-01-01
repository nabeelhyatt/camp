/**
 * Unified Chat API
 *
 * Switches between SQLite and Convex implementations based on the
 * campConfig.useConvexData feature flag.
 *
 * This file exports hooks with the SAME NAMES as the original SQLite hooks,
 * so consumers can simply change their import path.
 *
 * NOTE: Both SQLite and Convex hooks are always called (React hooks rule),
 * but only the selected implementation's data is returned.
 */

import { campConfig } from "@core/campConfig";
import {
    useChatsQueryConvex,
    useChatQueryConvex,
    useUngroupedChatsQueryConvex,
    usePrivateForksQueryConvex,
    useGetOrCreateNewChatConvex,
    useGetOrCreateNewQuickChatConvex,
    useCreateChatConvex,
    useRenameChatConvex,
    useDeleteChatConvex,
    useSetChatProjectConvex,
    useCreatePrivateForkConvex,
    usePublishSummaryConvex,
    chatKeys,
    chatQueries,
} from "./ChatAPIConvex";
import {
    useChat as useChatSQLite,
    useCreateNewChat as useCreateNewChatSQLite,
    useRenameChat as useRenameChatSQLite,
    useDeleteChat as useDeleteChatSQLite,
    fetchChats,
    fetchChat,
    // Re-export hooks that don't yet have Convex equivalents
    useGetOrCreateNewChat as useGetOrCreateNewChatSQLite,
    useGetOrCreateNewQuickChat as useGetOrCreateNewQuickChatSQLite,
    useConvertQuickChatToRegularChat,
    useCreateGroupChat,
    useCreateNewChat,
    useUpdateNewChat,
    useCacheUpdateChat,
    chatIsLoadingQueries,
    fetchChatIsLoading,
    // Re-export the Chat type
    type Chat,
} from "@core/chorus/api/ChatAPI";
import { useSetChatProject as useSetChatProjectSQLite } from "@core/chorus/api/ProjectAPI";
import { useQuery } from "@tanstack/react-query";

// Re-export hooks that don't yet have Convex equivalents (for backwards compatibility)
export {
    useConvertQuickChatToRegularChat,
    useCreateGroupChat,
    useCreateNewChat,
    useUpdateNewChat,
    useCacheUpdateChat,
    chatIsLoadingQueries,
    fetchChatIsLoading,
    type Chat,
};

// Re-export ConvexChat type for multiplayer features
export type { ConvexChat } from "./convexTypes";

// Re-export useChat as alias to useChatQuery (for backwards compatibility)
// UI code can continue using useChat or switch to useChatQuery
export { useChatQuery as useChat };

// Re-export query keys for cache compatibility
export { chatKeys, chatQueries };

// ============================================================
// Query Hooks
// ============================================================

/**
 * List all chats (optionally filtered by project)
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 * This is safe because the conditional always evaluates the same way per build,
 * maintaining React's hook call order requirements.
 */
export function useChatsQuery(options?: { projectId?: string }) {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useChatsQueryConvex(options);
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const sqliteResult = useQuery(chatQueries.list());

    // For SQLite, filter by projectId if provided
    if (options?.projectId && sqliteResult.data) {
        return {
            ...sqliteResult,
            data: sqliteResult.data.filter(
                (chat) => chat.projectId === options.projectId,
            ),
        };
    }

    return sqliteResult;
}

/**
 * Get a single chat by ID
 *
 * Note: If the chatId is a SQLite ID (32-char hex) and useConvexData is true,
 * we return undefined since SQLite chats are ignored in Convex mode.
 */
export function useChatQuery(chatId: string | undefined) {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useChatQueryConvex(chatId);
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useChatSQLite(chatId ?? "");
}

/**
 * Get ungrouped chats (not in any project)
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useUngroupedChatsQuery() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useUngroupedChatsQueryConvex();
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const sqliteResult = useQuery(chatQueries.list());

    // For SQLite, filter chats without projectId
    return {
        ...sqliteResult,
        data: sqliteResult.data?.filter(
            (chat) => !chat.projectId || chat.projectId === "default",
        ),
    };
}

/**
 * Get user's private forks
 * Note: This is a Convex-only feature for Phase 1
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function usePrivateForksQuery() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return usePrivateForksQueryConvex();
    }

    // SQLite doesn't have private forks - return empty
    return {
        data: [],
        isLoading: false,
        isError: false,
        error: null,
    };
}

// ============================================================
// Mutation Hooks
// ============================================================

/**
 * Get or create a new chat in a project
 * This is the main "New Chat" flow used by sidebar buttons and keyboard shortcuts
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 * This is safe because the conditional always evaluates the same way per build,
 * maintaining React's hook call order requirements.
 */
export function useGetOrCreateNewChat() {
    // campConfig.useConvexData is a build-time constant, so this branch is safe
    // Only call the hook for the active data layer to avoid side effects
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useGetOrCreateNewChatConvex();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useGetOrCreateNewChatSQLite();
}

/**
 * Get or create a new quick/ambient chat
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 * This is safe because the conditional always evaluates the same way per build,
 * maintaining React's hook call order requirements.
 */
export function useGetOrCreateNewQuickChat() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useGetOrCreateNewQuickChatConvex();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useGetOrCreateNewQuickChatSQLite();
}

/**
 * Create a new chat
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useCreateChat() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useCreateChatConvex();
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const sqliteMutation = useCreateNewChatSQLite();

    // Wrap SQLite mutation to match Convex interface
    const mutateAsync = async (options?: {
        projectId?: string;
        title?: string;
        isAmbient?: boolean;
        navigateToChat?: boolean;
    }) => {
        const chatId = await sqliteMutation.mutateAsync({
            projectId: options?.projectId ?? "default",
        });
        return chatId;
    };

    return {
        mutateAsync,
        mutate: (options?: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(options),
        isLoading: sqliteMutation.isPending,
        isPending: sqliteMutation.isPending,
        isIdle: !sqliteMutation.isPending,
    };
}

/**
 * Rename a chat
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useRenameChat() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useRenameChatConvex();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useRenameChatSQLite();
}

/**
 * Delete a chat
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useDeleteChat() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useDeleteChatConvex();
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const sqliteMutation = useDeleteChatSQLite();

    // Wrap SQLite mutation to match Convex interface
    const mutateAsync = async (args: {
        chatId: string;
        confirmCascade?: boolean;
    }) => {
        await sqliteMutation.mutateAsync({ chatId: args.chatId });
        return { success: true, forksDeleted: 0 };
    };

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isLoading: sqliteMutation.isPending,
        isPending: sqliteMutation.isPending,
        isIdle: !sqliteMutation.isPending,
    };
}

/**
 * Move a chat to a different project
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useSetChatProject() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useSetChatProjectConvex();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSetChatProjectSQLite();
}

/**
 * Create a private fork from a team chat
 * Note: This is a Convex-only feature for Phase 1
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useCreatePrivateFork() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useCreatePrivateForkConvex();
    }

    // SQLite doesn't support private forks
    const errorFn = () => {
        throw new Error(
            "Private forks require Convex. Enable useConvexData in campConfig.",
        );
    };
    return {
        mutateAsync: errorFn,
        mutate: errorFn,
        isLoading: false,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Publish a summary from a private fork to the parent chat
 * Note: This is a Convex-only feature for Phase 1
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function usePublishSummary() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return usePublishSummaryConvex();
    }

    // SQLite doesn't support this feature
    const errorFn = () => {
        throw new Error(
            "Summary publishing requires Convex. Enable useConvexData in campConfig.",
        );
    };
    return {
        mutateAsync: errorFn,
        mutate: errorFn,
        isLoading: false,
        isPending: false,
        isIdle: true,
    };
}

// ============================================================
// Direct Fetch Functions (for non-hook contexts)
// ============================================================

// Note: Convex doesn't support direct fetch functions like SQLite.
// These are provided for backwards compatibility but only work with SQLite.

export { fetchChats, fetchChat };
