/**
 * Unified Message API
 *
 * Switches between SQLite and Convex implementations based on the
 * campConfig.useConvexData feature flag.
 *
 * Phase 1 scope: Read-only message display via Convex.
 * Message mutations (streaming) continue via SQLite.
 */

import { campConfig } from "@core/campConfig";
import {
    useMessageSetsQueryConvex,
    useMessageQueryConvex,
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
// Note: Message Mutations
// ============================================================

/**
 * Message mutations (createSet, createUserMessage, appendMessagePart,
 * completeMessage, errorMessage, remove) are complex due to:
 * 1. Streaming response handling
 * 2. Tool call execution
 * 3. Multi-model parallel responses
 *
 * These continue to use the SQLite-based MessageAPI.ts for Phase 1.
 * The existing mutation hooks from MessageAPI.ts should be used directly:
 *
 * - useCreateNewMessage
 * - useUpdateMessageText
 * - useUpdateMessagePart
 * - useDeleteMessageSet
 * - etc.
 *
 * See MessageAPI.ts for the full list of mutation hooks.
 */
