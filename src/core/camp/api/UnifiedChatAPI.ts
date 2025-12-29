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
} from "@core/chorus/api/ChatAPI";
import { useSetChatProject as useSetChatProjectSQLite } from "@core/chorus/api/ProjectAPI";
import { useQuery } from "@tanstack/react-query";

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
 */
export function useChatQuery(chatId: string | undefined) {
    // Always call both hooks (React hooks rule)
    // Note: SQLite hook requires a string, so we pass empty string when undefined
    const sqliteResult = useChatSQLite(chatId ?? "");
    const convexResult = useChatQueryConvex(chatId);

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

    // Wrap SQLite mutation to match interface
    return {
        mutateAsync: async (options?: {
            projectId?: string;
            title?: string;
            isAmbient?: boolean;
            navigateToChat?: boolean;
        }) => {
            const chatId = await sqliteMutation.mutateAsync({
                projectId: options?.projectId ?? "default",
            });
            return chatId;
        },
        isLoading: sqliteMutation.isPending,
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

    // Wrap SQLite mutation to match interface
    return {
        mutateAsync: async (args: {
            chatId: string;
            confirmCascade?: boolean;
        }) => {
            await sqliteMutation.mutateAsync({ chatId: args.chatId });
            return { success: true, forksDeleted: 0 };
        },
        isLoading: sqliteMutation.isPending,
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
