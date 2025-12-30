/**
 * Unified Message API
 *
 * Switches between SQLite and Convex implementations based on the
 * campConfig.useConvexData feature flag.
 *
 * Phase 1: Read-only message display via Convex
 * Phase 2: Message mutations for creation and streaming
 */

import { campConfig } from "@core/campConfig";
import {
    useMessageSetsQueryConvex,
    useMessageQueryConvex,
    useCreateMessageSetConvex,
    useCreateUserMessageConvex,
    useCreateAssistantMessageConvex,
    useAppendMessagePartConvex,
    useUpdateStreamingContentConvex,
    useCompleteMessageConvex,
    useErrorMessageConvex,
    useDeleteMessageConvex,
    useCreateMessageSetPairConvex,
    useCreateMessageConvex,
    ConvexMessageSet,
    ConvexMessage,
    ConvexMessagePart,
} from "./MessageAPIConvex";
import * as MessageAPI from "@core/chorus/api/MessageAPI";

// Re-export types for convenience
export type { ConvexMessageSet, ConvexMessage, ConvexMessagePart };

// ============================================================
// Query Hooks
// ============================================================

/**
 * Hook to list message sets with messages for a chat
 *
 * This is the primary query for rendering chat messages.
 * When useConvexData is enabled, this returns real-time data from Convex.
 */
export function useMessageSetsQuery(chatId: string | undefined) {
    // Note: The Convex version is always called (for real-time sync),
    // but we only use its data when the feature flag is enabled.
    const convexResult = useMessageSetsQueryConvex(chatId);

    if (campConfig.useConvexData) {
        return convexResult;
    }

    // When not using Convex, return undefined to let the existing
    // SQLite-based message rendering continue working.
    // The existing code uses useMessageSets from MessageAPI.ts directly.
    return {
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
    };
}

/**
 * Hook to get a single message with parts
 */
export function useMessageQuery(messageId: string | undefined) {
    const convexResult = useMessageQueryConvex(messageId);

    if (campConfig.useConvexData) {
        return convexResult;
    }

    return {
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
    };
}

// ============================================================
// Mutation Hooks
// ============================================================

/**
 * Create a new message set (starts a new prompt/response cycle)
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useCreateMessageSet() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useCreateMessageSetConvex();
    }

    // SQLite fallback - not implemented in unified API yet
    // The existing MessageAPI.ts should be used directly for SQLite
    const errorFn = () => {
        throw new Error(
            "useCreateMessageSet requires Convex. Use MessageAPI.ts for SQLite.",
        );
    };
    return {
        mutateAsync: errorFn,
        mutate: errorFn,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Create a user message in a message set
 */
export function useCreateUserMessage() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useCreateUserMessageConvex();
    }

    const errorFn = () => {
        throw new Error(
            "useCreateUserMessage requires Convex. Use MessageAPI.ts for SQLite.",
        );
    };
    return {
        mutateAsync: errorFn,
        mutate: errorFn,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Create an assistant message (AI response)
 */
export function useCreateAssistantMessage() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useCreateAssistantMessageConvex();
    }

    const errorFn = () => {
        throw new Error(
            "useCreateAssistantMessage requires Convex. Use MessageAPI.ts for SQLite.",
        );
    };
    return {
        mutateAsync: errorFn,
        mutate: errorFn,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Append a message part (text, code, tool_call, etc.)
 */
export function useAppendMessagePart() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useAppendMessagePartConvex();
    }

    const errorFn = () => {
        throw new Error(
            "useAppendMessagePart requires Convex. Use MessageAPI.ts for SQLite.",
        );
    };
    return {
        mutateAsync: errorFn,
        mutate: errorFn,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Update streaming message content
 */
export function useUpdateStreamingContent() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useUpdateStreamingContentConvex();
    }

    const errorFn = () => {
        throw new Error(
            "useUpdateStreamingContent requires Convex. Use MessageAPI.ts for SQLite.",
        );
    };
    return {
        mutateAsync: errorFn,
        mutate: errorFn,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Mark a message as complete
 */
export function useCompleteMessage() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useCompleteMessageConvex();
    }

    const errorFn = () => {
        throw new Error(
            "useCompleteMessage requires Convex. Use MessageAPI.ts for SQLite.",
        );
    };
    return {
        mutateAsync: errorFn,
        mutate: errorFn,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Mark a message as errored
 */
export function useErrorMessage() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useErrorMessageConvex();
    }

    const errorFn = () => {
        throw new Error(
            "useErrorMessage requires Convex. Use MessageAPI.ts for SQLite.",
        );
    };
    return {
        mutateAsync: errorFn,
        mutate: errorFn,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Delete a message
 */
export function useDeleteMessage() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useDeleteMessageConvex();
    }

    const errorFn = () => {
        throw new Error(
            "useDeleteMessage requires Convex. Use MessageAPI.ts for SQLite.",
        );
    };
    return {
        mutateAsync: errorFn,
        mutate: errorFn,
        isPending: false,
        isIdle: true,
    };
}

// ============================================================
// Higher-Level Mutation Hooks (for ChatInput.tsx)
// ============================================================

/**
 * Create a message set pair (user + AI message sets)
 * This is used by ChatInput.tsx to create both message sets at once
 */
export function useCreateMessageSetPair() {
    const convexHook = useCreateMessageSetPairConvex();

    const sqliteHook = MessageAPI.useCreateMessageSetPair();

    if (campConfig.useConvexData) {
        return convexHook;
    }

    return sqliteHook;
}

/**
 * Create a message (user or AI)
 * This is used by ChatInput.tsx to create messages
 */
export function useCreateMessage() {
    const convexHook = useCreateMessageConvex();

    const sqliteHook = MessageAPI.useCreateMessage();

    if (campConfig.useConvexData) {
        return convexHook;
    }

    return sqliteHook;
}

/**
 * Force refresh message sets
 * For Convex, this is a no-op since Convex is reactive.
 * For SQLite, it invalidates the query cache.
 */
export function useForceRefreshMessageSets() {
    const sqliteHook = MessageAPI.useForceRefreshMessageSets();

    if (campConfig.useConvexData) {
        // Convex is reactive, so no need to force refresh
        // Return a no-op function with the same signature
        return (_chatId: string) => {
            // No-op for Convex - data is automatically synced
            return Promise.resolve([]);
        };
    }

    return sqliteHook;
}

/**
 * Generate chat title
 * This is used after sending a message to auto-generate a title
 */
export function useGenerateChatTitle() {
    // For now, both paths use the SQLite version since title generation
    // doesn't depend on which data layer is used for messages

    return MessageAPI.useGenerateChatTitle();
}

/**
 * Populate a block with AI responses
 * This is the main hook that triggers AI streaming
 *
 * NOTE: For Phase 1, we still use the SQLite version even when useConvexData=true.
 * The usePopulateBlockConvex implementation is complex and will be done in a follow-up.
 * This means AI responses will be stored in SQLite initially.
 */
export function usePopulateBlock(chatId: string, isQuickChatWindow: boolean) {
    const sqliteHook = MessageAPI.usePopulateBlock(chatId, isQuickChatWindow);

    // TODO: Implement usePopulateBlockConvex for full Convex streaming
    // For now, always use SQLite for AI response streaming
    // This is a temporary limitation - user messages go to Convex,
    // but AI responses still go through the SQLite streaming pipeline

    if (campConfig.useConvexData) {
        // TEMPORARY: Log that we're using SQLite for streaming even with Convex enabled
        console.warn(
            "[UnifiedMessageAPI] usePopulateBlock: Using SQLite streaming pipeline. " +
                "AI responses will be stored in SQLite, not Convex. " +
                "Full Convex streaming will be implemented in a follow-up.",
        );
    }

    return sqliteHook;
}

/**
 * Convert draft attachments to message attachments
 * This is used after creating a message to associate attachments
 */
export function useConvertDraftAttachmentsToMessageAttachments() {
    // For now, both paths use the SQLite version since attachments
    // aren't migrated to Convex yet

    return MessageAPI.useConvertDraftAttachmentsToMessageAttachments();
}
