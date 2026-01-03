/**
 * Convex Message API
 *
 * Provides hooks for message operations using the Convex backend.
 * Phase 1: Read-only queries for displaying messages
 * Phase 2: Mutations for message creation and streaming
 */

import { useQuery, useMutation, useConvex } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@convex/_generated/api";
import { useWorkspaceContext } from "./useWorkspaceHooks";
import { stringToConvexIdStrict, convexIdToString } from "./convexTypes";
import { campConfig } from "@core/campConfig";
import { useCallback, useState, useRef } from "react";
import { useChatQueryConvex } from "./ChatAPIConvex";
import {
    streamFromConvex,
    createStreamingSessionId,
} from "./ConvexStreamingClient";
import { llmConversation } from "@core/chorus/ChatState";
import type { LLMMessage, ModelConfig } from "@core/chorus/Models";
import type { BlockType } from "@core/chorus/ChatState";
import { modelConfigQueries } from "@core/chorus/api/ModelsAPI";
import { useGetProjectContextLLMMessage } from "./UnifiedProjectAPI";
import {
    convertConvexToMessageSetDetails,
    ConvexMessageSet,
    ConvexMessage,
    ConvexMessagePart,
} from "./convexTypes";

// Re-export types for backwards compatibility
export type { ConvexMessageSet, ConvexMessage, ConvexMessagePart };

// ============================================================
// Streaming Session Management
// ============================================================

/**
 * Module-level Map to track active streaming sessions.
 * Key: messageId, Value: AbortController
 *
 * This allows useStopMessageConvex to cancel streams started by usePopulateBlockConvex.
 */
const activeStreamingSessions = new Map<string, AbortController>();

/**
 * Register a streaming session for a message
 */
export function registerStreamingSession(
    messageId: string,
    abortController: AbortController,
): void {
    activeStreamingSessions.set(messageId, abortController);
}

/**
 * Unregister a streaming session when complete
 */
export function unregisterStreamingSession(messageId: string): void {
    activeStreamingSessions.delete(messageId);
}

/**
 * Abort a streaming session by messageId
 */
export function abortStreamingSession(messageId: string): boolean {
    const controller = activeStreamingSessions.get(messageId);
    if (controller) {
        controller.abort();
        activeStreamingSessions.delete(messageId);
        return true;
    }
    return false;
}

// ============================================================
// Queries
// ============================================================

/**
 * Hook to list message sets with messages for a chat
 * This is the main query for rendering a chat
 */
export function useMessageSetsQueryConvex(chatId: string | undefined) {
    const { clerkId, isLoading: contextLoading } = useWorkspaceContext();
    const chatQuery = useChatQueryConvex(chatId);

    // Skip Convex queries when not using Convex data layer
    const shouldSkip = !campConfig.useConvexData;

    const result = useQuery(
        api.messages.listSetsWithMessages,
        !shouldSkip && clerkId && chatId && !chatQuery.isError && chatQuery.data
            ? { clerkId, chatId: stringToConvexIdStrict<"chats">(chatId) }
            : "skip",
    );

    // Transform to frontend types
    const data = result
        ? result.map(
              (set): ConvexMessageSet => ({
                  id: convexIdToString(set._id),
                  chatId: convexIdToString(set.chatId),
                  createdAt: new Date(set.createdAt).toISOString(),
                  authorSnapshot: set.authorSnapshot
                      ? {
                            userId: convexIdToString(set.authorSnapshot.userId),
                            displayName: set.authorSnapshot.displayName,
                            avatarUrl: set.authorSnapshot.avatarUrl,
                        }
                      : undefined,
                  showAttribution: set.showAttribution,
                  messages: set.messages.map(
                      (msg): ConvexMessage => ({
                          id: convexIdToString(msg._id),
                          messageSetId: convexIdToString(msg.messageSetId),
                          chatId: convexIdToString(msg.chatId),
                          role: msg.role,
                          model: msg.model,
                          status: msg.status,
                          errorMessage: msg.errorMessage,
                          createdAt: new Date(msg.createdAt).toISOString(),
                          updatedAt: new Date(msg.updatedAt).toISOString(),
                          parts: msg.parts.map(
                              (part): ConvexMessagePart => ({
                                  id: convexIdToString(part._id),
                                  type: part.type,
                                  content: part.content,
                                  language: part.language,
                                  toolName: part.toolName,
                                  toolCallId: part.toolCallId,
                                  order: part.order,
                              }),
                          ),
                      }),
                  ),
              }),
          )
        : undefined;

    return {
        data,
        isLoading: contextLoading || (result === undefined && !!chatId),
        isError: chatQuery.isError,
        error: chatQuery.error,
    };
}

/**
 * Hook to get a single message with parts
 */
export function useMessageQueryConvex(messageId: string | undefined) {
    const { clerkId } = useWorkspaceContext();

    // Skip Convex queries when not using Convex data layer
    const shouldSkip = !campConfig.useConvexData;

    const result = useQuery(
        api.messages.get,
        !shouldSkip && clerkId && messageId
            ? {
                  clerkId,
                  messageId: stringToConvexIdStrict<"messages">(messageId),
              }
            : "skip",
    );

    const data = result
        ? {
              id: convexIdToString(result._id),
              messageSetId: convexIdToString(result.messageSetId),
              chatId: convexIdToString(result.chatId),
              role: result.role,
              model: result.model,
              status: result.status,
              errorMessage: result.errorMessage,
              createdAt: new Date(result.createdAt).toISOString(),
              updatedAt: new Date(result.updatedAt).toISOString(),
              parts: result.parts.map(
                  (part): ConvexMessagePart => ({
                      id: convexIdToString(part._id),
                      type: part.type,
                      content: part.content,
                      language: part.language,
                      toolName: part.toolName,
                      toolCallId: part.toolCallId,
                      order: part.order,
                  }),
              ),
          }
        : undefined;

    return {
        data,
        isLoading: result === undefined && !!messageId,
        isError: false,
        error: null,
    };
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create a new message set (starts a new prompt/response cycle)
 * Returns TanStack Query-compatible mutation interface
 */
export function useCreateMessageSetConvex() {
    const { clerkId } = useWorkspaceContext();
    const createSet = useMutation(api.messages.createSet);
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = useCallback(
        async (args: { chatId: string }) => {
            if (!clerkId) throw new Error("Not authenticated");
            setIsPending(true);
            try {
                const setId = await createSet({
                    clerkId,
                    chatId: stringToConvexIdStrict<"chats">(args.chatId),
                });
                return convexIdToString(setId);
            } finally {
                setIsPending(false);
            }
        },
        [clerkId, createSet],
    );

    return {
        mutateAsync,
        mutate: (args: { chatId: string }) => void mutateAsync(args),
        isPending,
        isIdle: !isPending,
    };
}

/**
 * Create a user message in a message set
 */
export function useCreateUserMessageConvex() {
    const { clerkId } = useWorkspaceContext();
    const createUserMessage = useMutation(api.messages.createUserMessage);
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = useCallback(
        async (args: { messageSetId: string; content: string }) => {
            if (!clerkId) throw new Error("Not authenticated");
            setIsPending(true);
            try {
                const messageId = await createUserMessage({
                    clerkId,
                    messageSetId: stringToConvexIdStrict<"messageSets">(
                        args.messageSetId,
                    ),
                    content: args.content,
                });
                return convexIdToString(messageId);
            } finally {
                setIsPending(false);
            }
        },
        [clerkId, createUserMessage],
    );

    return {
        mutateAsync,
        mutate: (args: { messageSetId: string; content: string }) =>
            void mutateAsync(args),
        isPending,
        isIdle: !isPending,
    };
}

/**
 * Create an assistant message (AI response)
 * Called when starting AI generation
 */
export function useCreateAssistantMessageConvex() {
    const { clerkId } = useWorkspaceContext();
    const createAssistantMessage = useMutation(
        api.messages.createAssistantMessage,
    );
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = useCallback(
        async (args: {
            messageSetId: string;
            model: string;
            streamingSessionId?: string;
        }) => {
            if (!clerkId) throw new Error("Not authenticated");
            setIsPending(true);
            try {
                const messageId = await createAssistantMessage({
                    clerkId,
                    messageSetId: stringToConvexIdStrict<"messageSets">(
                        args.messageSetId,
                    ),
                    model: args.model,
                    streamingSessionId: args.streamingSessionId,
                });
                return convexIdToString(messageId);
            } finally {
                setIsPending(false);
            }
        },
        [clerkId, createAssistantMessage],
    );

    return {
        mutateAsync,
        mutate: (args: {
            messageSetId: string;
            model: string;
            streamingSessionId?: string;
        }) => void mutateAsync(args),
        isPending,
        isIdle: !isPending,
    };
}

/**
 * Append a message part (text, code, tool_call, etc.)
 */
export function useAppendMessagePartConvex() {
    const { clerkId } = useWorkspaceContext();
    const appendMessagePart = useMutation(api.messages.appendMessagePart);
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = useCallback(
        async (args: {
            messageId: string;
            type:
                | "text"
                | "code"
                | "tool_call"
                | "tool_result"
                | "image"
                | "file";
            content: string;
            language?: string;
            toolName?: string;
            toolCallId?: string;
        }) => {
            if (!clerkId) throw new Error("Not authenticated");
            setIsPending(true);
            try {
                const partId = await appendMessagePart({
                    clerkId,
                    messageId: stringToConvexIdStrict<"messages">(
                        args.messageId,
                    ),
                    type: args.type,
                    content: args.content,
                    language: args.language,
                    toolName: args.toolName,
                    toolCallId: args.toolCallId,
                });
                return convexIdToString(partId);
            } finally {
                setIsPending(false);
            }
        },
        [clerkId, appendMessagePart],
    );

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isPending,
        isIdle: !isPending,
    };
}

/**
 * Update streaming message content
 * Used during AI response streaming to update content in real-time
 */
export function useUpdateStreamingContentConvex() {
    const { clerkId } = useWorkspaceContext();
    const upsertStreamingContent = useMutation(
        api.messages.upsertStreamingContent,
    );
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = useCallback(
        async (args: {
            messageId: string;
            content: string;
            streamingSessionId: string;
        }) => {
            if (!clerkId) throw new Error("Not authenticated");
            setIsPending(true);
            try {
                const result = await upsertStreamingContent({
                    clerkId,
                    messageId: stringToConvexIdStrict<"messages">(
                        args.messageId,
                    ),
                    content: args.content,
                    streamingSessionId: args.streamingSessionId,
                });
                return result;
            } finally {
                setIsPending(false);
            }
        },
        [clerkId, upsertStreamingContent],
    );

    return {
        mutateAsync,
        mutate: (args: {
            messageId: string;
            content: string;
            streamingSessionId: string;
        }) => void mutateAsync(args),
        isPending,
        isIdle: !isPending,
    };
}

/**
 * Mark a message as complete
 */
export function useCompleteMessageConvex() {
    const { clerkId } = useWorkspaceContext();
    const completeMessage = useMutation(api.messages.completeMessage);
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = useCallback(
        async (args: {
            messageId: string;
            status?: "complete" | "stopped";
        }) => {
            if (!clerkId) throw new Error("Not authenticated");
            setIsPending(true);
            try {
                await completeMessage({
                    clerkId,
                    messageId: stringToConvexIdStrict<"messages">(
                        args.messageId,
                    ),
                    status: args.status,
                });
                return { success: true };
            } finally {
                setIsPending(false);
            }
        },
        [clerkId, completeMessage],
    );

    return {
        mutateAsync,
        mutate: (args: {
            messageId: string;
            status?: "complete" | "stopped";
        }) => void mutateAsync(args),
        isPending,
        isIdle: !isPending,
    };
}

/**
 * Mark a message as errored
 */
export function useErrorMessageConvex() {
    const { clerkId } = useWorkspaceContext();
    const errorMessage = useMutation(api.messages.errorMessage);
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = useCallback(
        async (args: { messageId: string; errorMessage: string }) => {
            if (!clerkId) throw new Error("Not authenticated");
            setIsPending(true);
            try {
                await errorMessage({
                    clerkId,
                    messageId: stringToConvexIdStrict<"messages">(
                        args.messageId,
                    ),
                    errorMessage: args.errorMessage,
                });
                return { success: true };
            } finally {
                setIsPending(false);
            }
        },
        [clerkId, errorMessage],
    );

    return {
        mutateAsync,
        mutate: (args: { messageId: string; errorMessage: string }) =>
            void mutateAsync(args),
        isPending,
        isIdle: !isPending,
    };
}

/**
 * Delete a message (soft delete)
 */
export function useDeleteMessageConvex() {
    const { clerkId } = useWorkspaceContext();
    const removeMessage = useMutation(api.messages.remove);
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = useCallback(
        async (args: { messageId: string }) => {
            if (!clerkId) throw new Error("Not authenticated");
            setIsPending(true);
            try {
                await removeMessage({
                    clerkId,
                    messageId: stringToConvexIdStrict<"messages">(
                        args.messageId,
                    ),
                });
                return { success: true };
            } finally {
                setIsPending(false);
            }
        },
        [clerkId, removeMessage],
    );

    return {
        mutateAsync,
        mutate: (args: { messageId: string }) => void mutateAsync(args),
        isPending,
        isIdle: !isPending,
    };
}

// ============================================================
// Higher-Level Mutations (for ChatInput.tsx compatibility)
// ============================================================

/**
 * Create a message set pair (user + AI message sets)
 * This mirrors the SQLite useCreateMessageSetPair interface
 */
export function useCreateMessageSetPairConvex() {
    const { clerkId } = useWorkspaceContext();
    const createSet = useMutation(api.messages.createSet);
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = useCallback(
        async (args: {
            chatId: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            userMessageSetParent: any; // MessageSet type from SQLite - not used in Convex
            selectedBlockType: string;
        }) => {
            if (!clerkId) throw new Error("Not authenticated");
            setIsPending(true);
            try {
                const chatIdConvex = stringToConvexIdStrict<"chats">(
                    args.chatId,
                );

                // Create user message set
                const userMessageSetId = await createSet({
                    clerkId,
                    chatId: chatIdConvex,
                });

                // Create AI message set
                const aiMessageSetId = await createSet({
                    clerkId,
                    chatId: chatIdConvex,
                });

                return {
                    userMessageSetId: convexIdToString(userMessageSetId),
                    aiMessageSetId: convexIdToString(aiMessageSetId),
                };
            } finally {
                setIsPending(false);
            }
        },
        [clerkId, createSet],
    );

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isPending,
        isIdle: !isPending,
    };
}

/**
 * Create a message with return value matching SQLite's useCreateMessage
 * Returns { messageId, streamingToken } or undefined
 */
export function useCreateMessageConvex() {
    const createUserMessage = useCreateUserMessageConvex();
    const createAssistantMessage = useCreateAssistantMessageConvex();
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = useCallback(
        async (args: {
            message: {
                chatId: string;
                messageSetId: string;
                text?: string;
                model?: string;
                selected?: boolean;
                blockType: string;
                level?: number;
            };
            options?: {
                mode: "always" | "first" | "unique_model";
            };
        }) => {
            setIsPending(true);
            try {
                const { message } = args;

                // Determine if this is a user or assistant message based on blockType
                const isUserMessage = message.blockType === "user";

                // Helper to generate UUID (with fallback for older environments)
                const generateUUID = (): string => {
                    if (
                        typeof crypto !== "undefined" &&
                        crypto.randomUUID !== undefined
                    ) {
                        return crypto.randomUUID();
                    }
                    // Fallback for older environments
                    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
                        /[xy]/g,
                        (c) => {
                            const r = (Math.random() * 16) | 0;
                            const v = c === "x" ? r : (r & 0x3) | 0x8;
                            return v.toString(16);
                        },
                    );
                };

                if (isUserMessage) {
                    // Create user message
                    const messageId = await createUserMessage.mutateAsync({
                        messageSetId: message.messageSetId,
                        content: message.text || "",
                    });

                    // Generate a streaming token for compatibility
                    const streamingToken = generateUUID();

                    return { messageId, streamingToken };
                } else {
                    // Create assistant message
                    const streamingToken = generateUUID();
                    const messageId = await createAssistantMessage.mutateAsync({
                        messageSetId: message.messageSetId,
                        model: message.model || "unknown",
                        streamingSessionId: streamingToken,
                    });

                    return { messageId, streamingToken };
                }
            } finally {
                setIsPending(false);
            }
        },
        [createUserMessage, createAssistantMessage],
    );

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isPending,
        isIdle: !isPending,
    };
}

// ============================================================
// Streaming Hook (for AI response generation)
// ============================================================

/**
 * Populate a block with AI response via Convex streaming
 *
 * This is the Convex version of usePopulateBlock from MessageAPI.ts.
 * MVP scope:
 * - Single model support (no compare mode)
 * - No tool calls (deferred to post-MVP)
 * - Uses project context and message history
 */
export function usePopulateBlockConvex(
    chatId: string,
    isQuickChatWindow: boolean,
) {
    const queryClient = useQueryClient();
    const { clerkId } = useWorkspaceContext();
    const convex = useConvex();
    const createAssistantMessage = useCreateAssistantMessageConvex();
    // Note: completeMessage is called by the streaming HTTP action, not here
    const errorMessageMutation = useErrorMessageConvex();
    const getProjectContext = useGetProjectContextLLMMessage();

    // Get chat data from Convex (for projectId lookup)
    const chatResult = useQuery(
        api.chats.get,
        clerkId && chatId
            ? { clerkId, chatId: stringToConvexIdStrict<"chats">(chatId) }
            : "skip",
    );

    // NOTE: We removed the reactive messageSetsResult query here.
    // Instead, we fetch message sets imperatively in buildConversation
    // to ensure we always get the latest data, avoiding race conditions
    // where the reactive query hasn't updated yet after user message creation.

    // Track active streaming for cancellation
    const abortControllerRef = useRef<AbortController | null>(null);

    const [isPending, setIsPending] = useState(false);

    /**
     * Get selected model configs (same logic as SQLite version)
     */
    const getSelectedModelConfigs = useCallback(async (): Promise<
        ModelConfig[]
    > => {
        if (isQuickChatWindow) {
            const quickChatModelConfig = await queryClient.ensureQueryData(
                modelConfigQueries.quickChat(),
            );
            return quickChatModelConfig ? [quickChatModelConfig] : [];
        } else {
            return await queryClient.ensureQueryData(
                modelConfigQueries.compare(),
            );
        }
    }, [isQuickChatWindow, queryClient]);

    /**
     * Build conversation from Convex message sets
     * Uses IMPERATIVE fetch to get the latest message sets, avoiding race conditions
     * where the reactive query hasn't updated yet after user message creation.
     */
    const buildConversation = useCallback(
        async (excludeMessageSetId?: string): Promise<LLMMessage[]> => {
            // Get project context from Convex chat data
            // For MVP, skip project context if chat data not loaded yet
            let projectContext: LLMMessage[] = [];
            if (chatResult?.projectId) {
                const projectIdStr = convexIdToString(chatResult.projectId);
                projectContext = await getProjectContext(projectIdStr, chatId);
            }

            // CRITICAL: Fetch message sets imperatively to get the latest data
            // This avoids the race condition where the reactive query hasn't updated
            // yet after the user message was created.
            if (!clerkId) {
                console.log(
                    "[usePopulateBlockConvex] No clerkId, using empty conversation",
                );
                return projectContext;
            }

            const messageSetsResult = await convex.query(
                api.messages.listSetsWithMessages,
                { clerkId, chatId: stringToConvexIdStrict<"chats">(chatId) },
            );

            if (!messageSetsResult || messageSetsResult.length === 0) {
                console.log(
                    "[usePopulateBlockConvex] No message sets found, using empty conversation",
                );
                return projectContext;
            }

            // Transform to the format expected by llmConversation
            const convexMessageSets: ConvexMessageSet[] = messageSetsResult.map(
                (set) => ({
                    id: convexIdToString(set._id),
                    chatId: convexIdToString(set.chatId),
                    createdAt: new Date(set.createdAt).toISOString(),
                    showAttribution: set.showAttribution ?? false,
                    messages: set.messages.map((msg) => ({
                        id: convexIdToString(msg._id),
                        messageSetId: convexIdToString(msg.messageSetId),
                        chatId: convexIdToString(msg.chatId),
                        role: msg.role,
                        model: msg.model,
                        status: msg.status,
                        errorMessage: msg.errorMessage,
                        createdAt: new Date(msg.createdAt).toISOString(),
                        updatedAt: new Date(msg.updatedAt).toISOString(),
                        branchedFromId: msg.branchedFromId
                            ? convexIdToString(msg.branchedFromId)
                            : undefined,
                        replyChatId: msg.replyChatId
                            ? convexIdToString(msg.replyChatId)
                            : undefined,
                        selected: msg.selected,
                        parts: msg.parts.map((p) => ({
                            id: convexIdToString(p._id),
                            type: p.type,
                            content: p.content,
                            language: p.language,
                            toolName: p.toolName,
                            toolCallId: p.toolCallId,
                            order: p.order,
                        })),
                    })),
                }),
            );

            const messageSetDetails =
                convertConvexToMessageSetDetails(convexMessageSets);

            // Convert to LLM conversation format (exclude the message set we're populating)
            // This avoids dropping the latest user message when the AI set isn't yet visible.
            const previousMessageSets = excludeMessageSetId
                ? messageSetDetails.filter(
                      (set) => set.id !== excludeMessageSetId,
                  )
                : messageSetDetails;
            const conversation: LLMMessage[] = [
                ...projectContext,
                ...llmConversation(previousMessageSets),
            ];

            // DEBUG: Log full conversation being sent to AI
            console.log(
                `[usePopulateBlockConvex] Built conversation with ${conversation.length} messages from ${previousMessageSets.length} message sets`,
            );
            console.log(`[usePopulateBlockConvex] chatId: ${chatId}`);
            console.log(
                `[usePopulateBlockConvex] Full conversation:`,
                JSON.stringify(
                    conversation.map((msg, i) => ({
                        index: i,
                        role: msg.role,
                        contentPreview:
                            "content" in msg && typeof msg.content === "string"
                                ? msg.content.substring(0, 200) +
                                  (msg.content.length > 200 ? "..." : "")
                                : "[complex content]",
                    })),
                    null,
                    2,
                ),
            );

            return conversation;
        },
        [chatId, chatResult, clerkId, convex, getProjectContext],
    );

    const mutateAsync = useCallback(
        async (args: {
            messageSetId: string;
            blockType: BlockType;
            replyToModelId?: string;
        }): Promise<{ skipped: boolean }> => {
            if (!clerkId) {
                console.error(
                    "[usePopulateBlockConvex] Not authenticated, skipping",
                );
                return { skipped: true };
            }

            // Only support tools block for now (same as SQLite version)
            if (args.blockType !== "tools") {
                console.error(
                    `[usePopulateBlockConvex] Unsupported block type: ${args.blockType}`,
                );
                return { skipped: true };
            }

            setIsPending(true);

            // Create abort controller for cancellation
            abortControllerRef.current = new AbortController();

            try {
                // Get selected model configs
                const modelConfigs = await getSelectedModelConfigs();

                if (modelConfigs.length === 0) {
                    console.warn(
                        "[usePopulateBlockConvex] No model configs selected",
                    );
                    return { skipped: true };
                }

                // MVP: Only use the first model (no compare mode)
                const modelConfig = modelConfigs[0];
                console.log(
                    `[usePopulateBlockConvex] Starting stream with model: ${modelConfig.id}`,
                );
                console.log(
                    `[usePopulateBlockConvex] System prompt: ${modelConfig.systemPrompt ? modelConfig.systemPrompt.substring(0, 100) + "..." : "NONE"}`,
                );

                // Generate streaming session ID
                const streamingSessionId = createStreamingSessionId();

                // IMPORTANT: Build conversation BEFORE creating assistant message
                // to avoid race condition where reactive query updates mid-operation.
                // We want the conversation state at this exact moment, not after
                // the assistant message is created (which would add a new message set).
                const conversation = await buildConversation(args.messageSetId);

                // Create assistant message in Convex
                const messageId = await createAssistantMessage.mutateAsync({
                    messageSetId: args.messageSetId,
                    model: modelConfig.id,
                    streamingSessionId,
                });

                // Register streaming session so useStopMessageConvex can cancel it
                registerStreamingSession(messageId, abortControllerRef.current);

                // Stream from Convex HTTP endpoint
                await streamFromConvex({
                    clerkId,
                    messageId,
                    chatId,
                    model: modelConfig.id,
                    conversation,
                    streamingSessionId,
                    // Pass system prompt from model config (important for AI behavior!)
                    systemPrompt: modelConfig.systemPrompt,
                    // No tools for MVP
                    tools: undefined,
                    onChunk: (_chunk) => {
                        // Chunks are written to Convex by the HTTP action
                        // The UI updates via reactive queries
                        // We could add local optimistic updates here for faster feedback
                    },
                    onToolCall: undefined, // No tool calls for MVP
                    onComplete: (hasToolCalls) => {
                        if (hasToolCalls) {
                            // MVP doesn't support tool calls, log warning
                            console.warn(
                                "[usePopulateBlockConvex] Tool calls not supported in MVP",
                            );
                        }
                        // Message is already marked complete by the HTTP action
                    },
                    onError: async (errMsg) => {
                        console.error(
                            `[usePopulateBlockConvex] Streaming error: ${errMsg}`,
                        );
                        // Mark message as error
                        await errorMessageMutation.mutateAsync({
                            messageId,
                            errorMessage: errMsg,
                        });
                    },
                    signal: abortControllerRef.current.signal,
                });

                // Unregister streaming session now that we're done
                unregisterStreamingSession(messageId);

                // Invalidate queries to ensure UI updates
                await queryClient.invalidateQueries({
                    queryKey: ["chats", chatId, "messageSets", "list"],
                });

                return { skipped: false };
            } catch (error) {
                console.error("[usePopulateBlockConvex] Error:", error);
                return { skipped: true };
            } finally {
                setIsPending(false);
                abortControllerRef.current = null;
            }
        },
        [
            clerkId,
            chatId,
            getSelectedModelConfigs,
            buildConversation,
            createAssistantMessage,
            errorMessageMutation,
            queryClient,
        ],
    );

    // Cancel streaming
    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isPending,
        isIdle: !isPending,
        cancel,
    };
}

// ============================================================
// Stop Message Hook
// ============================================================

/**
 * Hook to stop a streaming message in Convex
 *
 * This aborts the active HTTP request (if any) and marks the message as stopped.
 * Works in conjunction with usePopulateBlockConvex which registers streaming sessions.
 */
export function useStopMessageConvex() {
    const { clerkId } = useWorkspaceContext();
    const completeMessage = useCompleteMessageConvex();
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = useCallback(
        async (args: { chatId: string; messageId: string }) => {
            if (!clerkId) {
                console.warn("[useStopMessageConvex] Not authenticated");
                return;
            }

            setIsPending(true);
            try {
                console.log(
                    `[useStopMessageConvex] Stopping message ${args.messageId}`,
                );

                // 1. Abort the HTTP streaming request if active
                const wasAborted = abortStreamingSession(args.messageId);
                if (wasAborted) {
                    console.log(
                        "[useStopMessageConvex] Aborted active streaming session",
                    );
                }

                // 2. Mark the message as stopped in Convex
                // Note: The HTTP action may also mark it complete, but stopped takes precedence
                await completeMessage.mutateAsync({
                    messageId: args.messageId,
                    status: "stopped",
                });

                console.log("[useStopMessageConvex] Message marked as stopped");
            } catch (error) {
                console.error("[useStopMessageConvex] Error:", error);
            } finally {
                setIsPending(false);
            }
        },
        [clerkId, completeMessage],
    );

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isPending,
        isIdle: !isPending,
    };
}
