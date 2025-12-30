/**
 * Convex Message API
 *
 * Provides hooks for message operations using the Convex backend.
 * Phase 1: Read-only queries for displaying messages
 * Phase 2: Mutations for message creation and streaming
 */

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useWorkspaceContext } from "./useWorkspaceHooks";
import { stringToConvexIdStrict, convexIdToString } from "./convexTypes";
import type { AuthorSnapshot } from "./convexTypes";
import { campConfig } from "@core/campConfig";
import { useCallback, useState } from "react";

// ============================================================
// Types
// ============================================================

/**
 * Message part from Convex
 */
export interface ConvexMessagePart {
    id: string;
    type: "text" | "code" | "tool_call" | "tool_result" | "image" | "file";
    content: string;
    language?: string;
    toolName?: string;
    toolCallId?: string;
    order: number;
}

/**
 * Message from Convex
 */
export interface ConvexMessage {
    id: string;
    messageSetId: string;
    chatId: string;
    role: "user" | "assistant";
    model?: string;
    status: "pending" | "streaming" | "complete" | "error";
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
    parts: ConvexMessagePart[];
}

/**
 * Message set from Convex with author info
 */
export interface ConvexMessageSet {
    id: string;
    chatId: string;
    createdAt: string;
    authorSnapshot?: AuthorSnapshot;
    showAttribution: boolean;
    messages: ConvexMessage[];
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

    // Skip Convex queries when not using Convex data layer
    const shouldSkip = !campConfig.useConvexData;

    const result = useQuery(
        api.messages.listSetsWithMessages,
        !shouldSkip && clerkId && chatId
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
        isError: false,
        error: null,
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
        async (args: { messageId: string }) => {
            if (!clerkId) throw new Error("Not authenticated");
            setIsPending(true);
            try {
                await completeMessage({
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
        [clerkId, completeMessage],
    );

    return {
        mutateAsync,
        mutate: (args: { messageId: string }) => void mutateAsync(args),
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
