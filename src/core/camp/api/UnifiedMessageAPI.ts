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
    usePopulateBlockConvex,
    ConvexMessageSet,
    ConvexMessage,
    ConvexMessagePart,
} from "./MessageAPIConvex";
import * as MessageAPI from "@core/chorus/api/MessageAPI";
import type {
    MessageSetDetail,
    Message,
    MessagePart,
    UserBlock,
    ChatBlock,
    CompareBlock,
    BrainstormBlock,
    ToolsBlock,
    BlockType,
} from "@core/chorus/ChatState";

// Re-export types for convenience
export type { ConvexMessageSet, ConvexMessage, ConvexMessagePart };

// ============================================================
// Convex → SQLite Type Transformation
// ============================================================

/**
 * Convert a Convex message part to the SQLite MessagePart format
 */
function convertConvexPart(
    part: ConvexMessagePart,
    chatId: string,
    messageId: string,
): MessagePart {
    return {
        chatId,
        messageId,
        level: part.order,
        content: part.content,
        // Tool calls/results are stored differently in Convex - not in parts
        toolCalls: undefined,
        toolResults: undefined,
    };
}

/**
 * Convert a Convex message to the SQLite Message format
 */
function convertConvexMessage(msg: ConvexMessage): Message {
    // Combine all text parts into a single text field
    const textParts = msg.parts.filter((p) => p.type === "text");
    const text = textParts.map((p) => p.content).join("");

    // Map Convex status to SQLite state
    const state: "streaming" | "idle" =
        msg.status === "streaming" ? "streaming" : "idle";

    // Determine blockType from role
    // In Convex, we simplified to just role (user/assistant)
    // Map assistant → "tools" (the default block type)
    const blockType: BlockType = msg.role === "user" ? "user" : "tools";

    return {
        id: msg.id,
        chatId: msg.chatId,
        messageSetId: msg.messageSetId,
        blockType,
        text,
        model: msg.model || (msg.role === "user" ? "user" : "unknown"),
        selected: true, // Default to selected for now
        attachments: undefined, // Attachments not yet in Convex
        isReview: false,
        state,
        streamingToken: undefined,
        errorMessage: msg.errorMessage,
        reviewState: undefined,
        level: undefined,
        parts: msg.parts.map((p) => convertConvexPart(p, msg.chatId, msg.id)),
        replyChatId: undefined,
        branchedFromId: undefined,
    };
}

/**
 * Convert Convex message sets to SQLite MessageSetDetail format
 *
 * This transformation allows the existing MultiChat.tsx UI to render
 * Convex data without changes.
 */
function convertConvexToMessageSetDetails(
    convexSets: ConvexMessageSet[],
): MessageSetDetail[] {
    return convexSets.map((set, index) => {
        // Convert all messages
        const messages = set.messages.map(convertConvexMessage);

        // Separate by block type
        const userBlockMessages = messages.filter(
            (m) => m.blockType === "user",
        );
        const toolsBlockMessages = messages.filter(
            (m) => m.blockType === "tools",
        );

        // Build blocks (compare and brainstorm are deprecated, but structure needs them)
        const userBlock: UserBlock = {
            type: "user",
            message: userBlockMessages[0],
        };

        const chatBlock: ChatBlock = {
            type: "chat",
            message: undefined, // Deprecated
            reviews: [],
        };

        const compareBlock: CompareBlock = {
            type: "compare",
            messages: [],
            synthesis: undefined,
        };

        const brainstormBlock: BrainstormBlock = {
            type: "brainstorm",
            ideaMessages: [],
        };

        const toolsBlock: ToolsBlock = {
            type: "tools",
            chatMessages: toolsBlockMessages,
        };

        // Determine set type from messages
        const hasUserMessage = userBlockMessages.length > 0;
        const type = hasUserMessage ? "user" : "ai";

        // Default selected block type
        const selectedBlockType: BlockType = hasUserMessage ? "user" : "tools";

        return {
            id: set.id,
            chatId: set.chatId,
            type,
            level: index,
            selectedBlockType,
            createdAt: set.createdAt,
            userBlock,
            chatBlock,
            compareBlock,
            brainstormBlock,
            toolsBlock,
        };
    });
}

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
 * Unified hook to list message sets, compatible with both SQLite and Convex
 *
 * Returns the same shape as MessageAPI.useMessageSets for drop-in replacement.
 * When useConvexData=true, transforms Convex data to MessageSetDetail format.
 */
export function useMessageSets(
    chatId: string,
    select?: (data: MessageSetDetail[]) => MessageSetDetail[],
) {
    // Always call both hooks (React rules)
    const sqliteResult = MessageAPI.useMessageSets(chatId, select);
    const convexResult = useMessageSetsQueryConvex(chatId);

    if (campConfig.useConvexData) {
        // Transform Convex data to MessageSetDetail format
        const transformedData = convexResult.data
            ? convertConvexToMessageSetDetails(convexResult.data)
            : undefined;

        // Apply select function if provided
        const finalData =
            transformedData && select
                ? select(transformedData)
                : transformedData;

        // Return a TanStack Query-like result shape
        return {
            data: finalData,
            isLoading: convexResult.isLoading,
            isError: convexResult.isError,
            error: convexResult.error,
            isPending: convexResult.isLoading,
            isSuccess: !convexResult.isLoading && !convexResult.isError,
            status: convexResult.isLoading
                ? ("pending" as const)
                : convexResult.isError
                  ? ("error" as const)
                  : ("success" as const),
            // These are used by some components
            refetch: () => Promise.resolve({ data: finalData }),
            isFetching: false,
            isRefetching: false,
        };
    }

    return sqliteResult;
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
 * When useConvexData=true:
 * - Creates assistant message in Convex
 * - Streams via Convex HTTP action
 * - Writes content to Convex periodically for real-time sync
 *
 * MVP limitations:
 * - Single model only (no compare mode)
 * - No tool calls (deferred to post-MVP)
 */
export function usePopulateBlock(chatId: string, isQuickChatWindow: boolean) {
    // Note: Both hooks must be called unconditionally to satisfy React rules
    const sqliteHook = MessageAPI.usePopulateBlock(chatId, isQuickChatWindow);
    const convexHook = usePopulateBlockConvex(chatId, isQuickChatWindow);

    if (campConfig.useConvexData) {
        return convexHook;
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
