/**
 * Convex Message API
 *
 * Provides hooks for message operations using the Convex backend.
 * Phase 1 scope: Read-only (display messages in chat).
 * Message mutations (streaming) are complex and deferred.
 */

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useWorkspaceContext } from "./useWorkspaceHooks";
import { stringToConvexIdStrict, convexIdToString } from "./convexTypes";
import type { AuthorSnapshot } from "./convexTypes";
import { campConfig } from "@core/campConfig";

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
// Note: Mutations deferred to Phase 2+
// ============================================================
// Message mutations (createSet, createUserMessage, appendMessagePart,
// completeMessage, errorMessage, remove) are complex due to streaming
// and tool call handling. These are deferred to Phase 2.
//
// For Phase 1, the existing SQLite-based message flow continues to work
// for sending messages, while Convex is used for displaying them.
