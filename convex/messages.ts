import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
    getUserByClerkIdOrThrow,
    assertCanAccessChat,
} from "./lib/permissions";
import { logAudit } from "./lib/audit";

/**
 * Message operations for Camp multiplayer
 *
 * Messages are organized into MessageSets (one prompt = one set).
 * Each MessageSet can have multiple Messages (user message + AI responses).
 * Messages have MessageParts (text, code, tool calls, etc.).
 *
 * Key feature: Author snapshots for Slack-style attribution without joins.
 */

// ============================================================
// Queries
// ============================================================

/**
 * List message sets for a chat
 */
export const listSets = query({
    args: {
        clerkId: v.string(),
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify chat access
        await assertCanAccessChat(ctx, args.chatId, user._id);

        const messageSets = await ctx.db
            .query("messageSets")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        // Sort by creation time
        return messageSets.sort((a, b) => a.createdAt - b.createdAt);
    },
});

/**
 * List message sets with their messages and author info
 * This is the main query for rendering a chat
 */
export const listSetsWithMessages = query({
    args: {
        clerkId: v.string(),
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify chat access
        const chat = await assertCanAccessChat(ctx, args.chatId, user._id);

        const messageSets = await ctx.db
            .query("messageSets")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        // For each message set, get messages and parts
        const setsWithMessages = await Promise.all(
            messageSets.map(async (set) => {
                const messages = await ctx.db
                    .query("messages")
                    .withIndex("by_message_set", (q) =>
                        q.eq("messageSetId", set._id),
                    )
                    .filter((q) => q.eq(q.field("deletedAt"), undefined))
                    .collect();

                // Get parts for each message
                const messagesWithParts = await Promise.all(
                    messages.map(async (msg) => {
                        const parts = await ctx.db
                            .query("messageParts")
                            .withIndex("by_message", (q) =>
                                q.eq("messageId", msg._id),
                            )
                            .filter((q) =>
                                q.eq(q.field("deletedAt"), undefined),
                            )
                            .collect();

                        return {
                            ...msg,
                            parts: parts.sort((a, b) => a.order - b.order),
                        };
                    }),
                );

                return {
                    ...set,
                    messages: messagesWithParts.sort(
                        (a, b) => a.createdAt - b.createdAt,
                    ),
                    // Include chat visibility for UI to decide on attribution
                    showAttribution:
                        chat.visibility !== "private" ||
                        chat.createdBy !== user._id,
                };
            }),
        );

        return setsWithMessages.sort((a, b) => a.createdAt - b.createdAt);
    },
});

/**
 * Get a single message with its parts
 */
export const get = query({
    args: {
        clerkId: v.string(),
        messageId: v.id("messages"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        const message = await ctx.db.get(args.messageId);
        if (!message || message.deletedAt) {
            throw new Error("Message not found");
        }

        // Verify chat access
        await assertCanAccessChat(ctx, message.chatId, user._id);

        // Get message parts
        const parts = await ctx.db
            .query("messageParts")
            .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        return {
            ...message,
            parts: parts.sort((a, b) => a.order - b.order),
        };
    },
});

// ============================================================
// Mutations
// ============================================================

/**
 * Create a new message set (starts a new prompt/response cycle)
 */
export const createSet = mutation({
    args: {
        clerkId: v.string(),
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify chat access
        await assertCanAccessChat(ctx, args.chatId, user._id);

        const now = Date.now();

        const messageSetId = await ctx.db.insert("messageSets", {
            chatId: args.chatId,
            createdBy: user._id,
            createdAt: now,
            // Embed author snapshot for Slack-style attribution
            authorSnapshot: {
                userId: user._id,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
            },
        });

        // Update chat's updatedAt
        await ctx.db.patch(args.chatId, {
            updatedAt: now,
        });

        return messageSetId;
    },
});

/**
 * Create a user message in a message set
 */
export const createUserMessage = mutation({
    args: {
        clerkId: v.string(),
        messageSetId: v.id("messageSets"),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Get message set
        const messageSet = await ctx.db.get(args.messageSetId);
        if (!messageSet || messageSet.deletedAt) {
            throw new Error("Message set not found");
        }

        // Verify chat access
        const chat = await assertCanAccessChat(
            ctx,
            messageSet.chatId,
            user._id,
        );

        const now = Date.now();

        // Create the message
        const messageId = await ctx.db.insert("messages", {
            messageSetId: args.messageSetId,
            chatId: messageSet.chatId,
            role: "user",
            status: "complete",
            createdAt: now,
            updatedAt: now,
        });

        // Create the text content
        await ctx.db.insert("messageParts", {
            messageId,
            type: "text",
            content: args.content,
            order: 0,
            createdAt: now,
        });

        // Update chat's updatedAt
        await ctx.db.patch(messageSet.chatId, {
            updatedAt: now,
        });

        // Audit log
        await logAudit(ctx, {
            workspaceId: chat.workspaceId,
            userId: user._id,
            action: "message.send",
            entityType: "message",
            entityId: messageId,
            metadata: {
                chatId: messageSet.chatId,
                role: "user",
                contentLength: args.content.length,
            },
        });

        return messageId;
    },
});

/**
 * Create an assistant message (AI response)
 * Called when starting AI generation
 */
export const createAssistantMessage = mutation({
    args: {
        clerkId: v.string(),
        messageSetId: v.id("messageSets"),
        model: v.string(),
        streamingSessionId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Get message set
        const messageSet = await ctx.db.get(args.messageSetId);
        if (!messageSet || messageSet.deletedAt) {
            throw new Error("Message set not found");
        }

        // Verify chat access
        await assertCanAccessChat(ctx, messageSet.chatId, user._id);

        const now = Date.now();

        // Create the message in streaming state
        const messageId = await ctx.db.insert("messages", {
            messageSetId: args.messageSetId,
            chatId: messageSet.chatId,
            role: "assistant",
            model: args.model,
            status: "streaming",
            streamingSessionId: args.streamingSessionId,
            createdAt: now,
            updatedAt: now,
        });

        // Update chat's updatedAt
        await ctx.db.patch(messageSet.chatId, {
            updatedAt: now,
        });

        return messageId;
    },
});

/**
 * Append content to a streaming message
 */
export const appendMessagePart = mutation({
    args: {
        clerkId: v.string(),
        messageId: v.id("messages"),
        type: v.union(
            v.literal("text"),
            v.literal("code"),
            v.literal("tool_call"),
            v.literal("tool_result"),
            v.literal("image"),
            v.literal("file"),
        ),
        content: v.string(),
        language: v.optional(v.string()),
        toolName: v.optional(v.string()),
        toolCallId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Get message
        const message = await ctx.db.get(args.messageId);
        if (!message || message.deletedAt) {
            throw new Error("Message not found");
        }

        // Verify chat access
        await assertCanAccessChat(ctx, message.chatId, user._id);

        // Get current max order
        const existingParts = await ctx.db
            .query("messageParts")
            .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
            .collect();

        const maxOrder = existingParts.reduce(
            (max, p) => Math.max(max, p.order),
            -1,
        );

        const now = Date.now();

        // Create the new part
        const partId = await ctx.db.insert("messageParts", {
            messageId: args.messageId,
            type: args.type,
            content: args.content,
            language: args.language,
            toolName: args.toolName,
            toolCallId: args.toolCallId,
            order: maxOrder + 1,
            createdAt: now,
        });

        // Update message's updatedAt
        await ctx.db.patch(args.messageId, {
            updatedAt: now,
        });

        return partId;
    },
});

/**
 * Mark a message as complete
 */
export const completeMessage = mutation({
    args: {
        clerkId: v.string(),
        messageId: v.id("messages"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Get message
        const message = await ctx.db.get(args.messageId);
        if (!message || message.deletedAt) {
            throw new Error("Message not found");
        }

        // Verify chat access
        await assertCanAccessChat(ctx, message.chatId, user._id);

        await ctx.db.patch(args.messageId, {
            status: "complete",
            streamingSessionId: undefined,
            updatedAt: Date.now(),
        });

        return { success: true };
    },
});

/**
 * Mark a message as errored
 */
export const errorMessage = mutation({
    args: {
        clerkId: v.string(),
        messageId: v.id("messages"),
        errorMessage: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Get message
        const message = await ctx.db.get(args.messageId);
        if (!message || message.deletedAt) {
            throw new Error("Message not found");
        }

        // Verify chat access
        await assertCanAccessChat(ctx, message.chatId, user._id);

        await ctx.db.patch(args.messageId, {
            status: "error",
            errorMessage: args.errorMessage,
            streamingSessionId: undefined,
            updatedAt: Date.now(),
        });

        return { success: true };
    },
});

/**
 * Delete a message (soft delete)
 */
export const remove = mutation({
    args: {
        clerkId: v.string(),
        messageId: v.id("messages"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Get message
        const message = await ctx.db.get(args.messageId);
        if (!message || message.deletedAt) {
            throw new Error("Message not found");
        }

        // Verify chat access
        const chat = await assertCanAccessChat(ctx, message.chatId, user._id);

        const now = Date.now();

        // Soft delete the message
        await ctx.db.patch(args.messageId, {
            deletedAt: now,
            deletedBy: user._id,
        });

        // Soft delete all parts
        const parts = await ctx.db
            .query("messageParts")
            .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
            .collect();

        for (const part of parts) {
            await ctx.db.patch(part._id, {
                deletedAt: now,
                deletedBy: user._id,
            });
        }

        // Audit log
        await logAudit(ctx, {
            workspaceId: chat.workspaceId,
            userId: user._id,
            action: "message.delete",
            entityType: "message",
            entityId: args.messageId,
            metadata: {
                chatId: message.chatId,
                partsDeleted: parts.length,
            },
        });

        return { success: true };
    },
});
