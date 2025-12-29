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
    useGetOrCreateNewChat,
    useGetOrCreateNewQuickChat,
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
    useGetOrCreateNewChat,
    useGetOrCreateNewQuickChat,
    useConvertQuickChatToRegularChat,
    useCreateGroupChat,
    useCreateNewChat,
    useUpdateNewChat,
    useCacheUpdateChat,
    chatIsLoadingQueries,
    fetchChatIsLoading,
    type Chat,
};

// Re-export useChat as alias to useChatQuery (for backwards compatibility)
// UI code can continue using useChat or switch to useChatQuery
export { useChatSQLite as useChat };

// Re-export query keys for cache compatibility
export { chatKeys, chatQueries };

// ============================================================
// Query Hooks
// ============================================================

/**
 * List all chats (optionally filtered by project)
 */
export function useChatsQuery(options?: { projectId?: string }) {
    // Always call both hooks (React hooks rule)
    const sqliteResult = useQuery({
        ...chatQueries.list(),
        enabled: !campConfig.useConvexData,
    });

    const convexResult = useChatsQueryConvex(options);

    if (campConfig.useConvexData) {
        return convexResult;
    }

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
    // Always call both hooks (React hooks rule)
    // Note: SQLite hook requires a string, so we pass empty string when undefined
    const sqliteResult = useChatSQLite(chatId ?? "");
    const convexResult = useChatQueryConvex(chatId);

    // If Convex mode but this is a SQLite ID, return empty result (ignore SQLite chats)
    if (campConfig.useConvexData && convexResult.isSQLiteChat) {
        return {
            data: undefined,
            isLoading: false,
            isError: false,
            error: null,
        };
    }

    return campConfig.useConvexData ? convexResult : sqliteResult;
}

/**
 * Get ungrouped chats (not in any project)
 */
export function useUngroupedChatsQuery() {
    // Always call both hooks (React hooks rule)
    const sqliteResult = useQuery({
        ...chatQueries.list(),
        enabled: !campConfig.useConvexData,
    });

    const convexResult = useUngroupedChatsQueryConvex();

    if (campConfig.useConvexData) {
        return convexResult;
    }

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
 */
export function usePrivateForksQuery() {
    // Always call the Convex hook (React hooks rule)
    const convexResult = usePrivateForksQueryConvex();

    if (campConfig.useConvexData) {
        return convexResult;
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
 * Create a new chat
 */
export function useCreateChat() {
    // Always call both hooks (React hooks rule)
    const convexMutation = useCreateChatConvex();
    const sqliteMutation = useCreateNewChatSQLite();

    if (campConfig.useConvexData) {
        return convexMutation;
    }

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
 */
export function useRenameChat() {
    // Always call both hooks (React hooks rule)
    const convexMutation = useRenameChatConvex();
    const sqliteMutation = useRenameChatSQLite();

    return campConfig.useConvexData ? convexMutation : sqliteMutation;
}

/**
 * Delete a chat
 */
export function useDeleteChat() {
    // Always call both hooks (React hooks rule)
    const convexMutation = useDeleteChatConvex();
    const sqliteMutation = useDeleteChatSQLite();

    if (campConfig.useConvexData) {
        return convexMutation;
    }

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
 */
export function useSetChatProject() {
    // Always call both hooks (React hooks rule)
    const convexMutation = useSetChatProjectConvex();
    const sqliteMutation = useSetChatProjectSQLite();

    return campConfig.useConvexData ? convexMutation : sqliteMutation;
}

/**
 * Create a private fork from a team chat
 * Note: This is a Convex-only feature for Phase 1
 */
export function useCreatePrivateFork() {
    // Always call the Convex hook (React hooks rule)
    const convexMutation = useCreatePrivateForkConvex();

    if (campConfig.useConvexData) {
        return convexMutation;
    }

    // SQLite doesn't support private forks
    return {
        mutateAsync: () => {
            throw new Error(
                "Private forks require Convex. Enable useConvexData in campConfig.",
            );
        },
        isLoading: false,
    };
}

/**
 * Publish a summary from a private fork to the parent chat
 * Note: This is a Convex-only feature for Phase 1
 */
export function usePublishSummary() {
    // Always call the Convex hook (React hooks rule)
    const convexMutation = usePublishSummaryConvex();

    if (campConfig.useConvexData) {
        return convexMutation;
    }

    // SQLite doesn't support this feature
    return {
        mutateAsync: () => {
            throw new Error(
                "Summary publishing requires Convex. Enable useConvexData in campConfig.",
            );
        },
        isLoading: false,
    };
}

// ============================================================
// Direct Fetch Functions (for non-hook contexts)
// ============================================================

// Note: Convex doesn't support direct fetch functions like SQLite.
// These are provided for backwards compatibility but only work with SQLite.

export { fetchChats, fetchChat };
