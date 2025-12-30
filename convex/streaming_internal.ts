import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Internal functions for streaming HTTP action
 *
 * These are called by the streaming HTTP action to read/write data.
 * They're internal to prevent direct client access.
 */

/**
 * Get a chat by ID (for workspace lookup)
 */
export const getChat = internalQuery({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.chatId);
    },
});

/**
 * Update streaming content for a message
 * This creates or updates the text part with accumulated content
 */
export const updateStreamingContent = internalMutation({
    args: {
        messageId: v.id("messages"),
        content: v.string(),
        streamingSessionId: v.string(),
    },
    handler: async (ctx, args) => {
        // Get message
        const message = await ctx.db.get(args.messageId);
        if (!message || message.deletedAt) {
            return { updated: false, reason: "message_not_found" };
        }

        // Verify streaming session matches
        if (message.streamingSessionId !== args.streamingSessionId) {
            return { updated: false, reason: "session_mismatch" };
        }

        const now = Date.now();

        // Check if a text part already exists
        const existingPart = await ctx.db
            .query("messageParts")
            .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
            .filter((q) =>
                q.and(
                    q.eq(q.field("type"), "text"),
                    q.eq(q.field("deletedAt"), undefined),
                ),
            )
            .first();

        if (existingPart) {
            // Update existing part
            await ctx.db.patch(existingPart._id, {
                content: args.content,
            });
        } else {
            // Create new text part
            await ctx.db.insert("messageParts", {
                messageId: args.messageId,
                type: "text",
                content: args.content,
                order: 0,
                createdAt: now,
            });
        }

        // Update message's updatedAt
        await ctx.db.patch(args.messageId, {
            updatedAt: now,
        });

        return { updated: true };
    },
});

/**
 * Mark a message as complete
 */
export const completeMessage = internalMutation({
    args: {
        messageId: v.id("messages"),
    },
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message || message.deletedAt) {
            return { success: false, reason: "message_not_found" };
        }

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
export const errorMessage = internalMutation({
    args: {
        messageId: v.id("messages"),
        errorMessage: v.string(),
    },
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message || message.deletedAt) {
            return { success: false, reason: "message_not_found" };
        }

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
 * Append a tool call part to a message
 */
export const appendToolCallPart = internalMutation({
    args: {
        messageId: v.id("messages"),
        toolName: v.string(),
        toolCallId: v.string(),
        content: v.string(), // JSON stringified args
    },
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message || message.deletedAt) {
            return { success: false, reason: "message_not_found" };
        }

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

        // Create the tool call part
        const partId = await ctx.db.insert("messageParts", {
            messageId: args.messageId,
            type: "tool_call",
            content: args.content,
            toolName: args.toolName,
            toolCallId: args.toolCallId,
            order: maxOrder + 1,
            createdAt: now,
        });

        // Update message's updatedAt
        await ctx.db.patch(args.messageId, {
            updatedAt: now,
        });

        return { success: true, partId };
    },
});
