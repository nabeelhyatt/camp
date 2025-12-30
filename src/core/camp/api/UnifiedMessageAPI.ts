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
    ConvexMessageSet,
    ConvexMessage,
    ConvexMessagePart,
} from "./MessageAPIConvex";

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
