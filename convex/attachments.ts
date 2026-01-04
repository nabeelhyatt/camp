import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
    getUserByClerkIdOrThrow,
    assertCanAccessChat,
} from "./lib/permissions";
import { logAudit } from "./lib/audit";

/**
 * Attachment operations for Camp multiplayer
 *
 * Handles file uploads/downloads using Convex storage.
 * Files are uploaded directly to Convex storage, then metadata is saved to the DB.
 *
 * Upload flow:
 * 1. Client calls generateUploadUrl() to get a short-lived upload URL
 * 2. Client POSTs file to that URL, receives storageId
 * 3. Client calls saveAttachment() with storageId and metadata
 *
 * Download flow:
 * 1. Client calls getUrl() or listForChat() to get download URLs
 * 2. URLs are short-lived but can be refreshed by calling again
 */

// ============================================================
// Mutations
// ============================================================

/**
 * Generate a short-lived upload URL
 * Returns a URL that the client can POST a file to
 */
export const generateUploadUrl = mutation({
    args: {
        clerkId: v.string(),
    },
    handler: async (ctx, args) => {
        // Verify user is authenticated
        await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Generate and return upload URL
        return await ctx.storage.generateUploadUrl();
    },
});

/**
 * Save attachment metadata after successful upload
 * Called after the file has been uploaded to the storage URL
 */
export const saveAttachment = mutation({
    args: {
        clerkId: v.string(),
        chatId: v.id("chats"),
        messageId: v.optional(v.id("messages")),
        storageId: v.id("_storage"),
        filename: v.string(),
        mimeType: v.string(),
        sizeBytes: v.number(),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify chat access
        const chat = await assertCanAccessChat(ctx, args.chatId, user._id);

        const now = Date.now();

        const attachmentId = await ctx.db.insert("attachments", {
            chatId: args.chatId,
            messageId: args.messageId,
            uploadedBy: user._id,
            storageId: args.storageId,
            filename: args.filename,
            mimeType: args.mimeType,
            sizeBytes: args.sizeBytes,
            createdAt: now,
        });

        // Audit log
        await logAudit(ctx, {
            workspaceId: chat.workspaceId,
            userId: user._id,
            action: "attachment.upload",
            entityType: "attachment",
            entityId: attachmentId,
            metadata: {
                chatId: args.chatId,
                messageId: args.messageId,
                filename: args.filename,
                mimeType: args.mimeType,
                sizeBytes: args.sizeBytes,
            },
        });

        return attachmentId;
    },
});

/**
 * Delete an attachment (soft delete)
 */
export const remove = mutation({
    args: {
        clerkId: v.string(),
        attachmentId: v.id("attachments"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        const attachment = await ctx.db.get(args.attachmentId);
        if (!attachment || attachment.deletedAt) {
            throw new Error("Attachment not found");
        }

        // Verify chat access
        const chat = await assertCanAccessChat(
            ctx,
            attachment.chatId,
            user._id,
        );

        // Only uploader can delete their own attachments
        if (attachment.uploadedBy !== user._id) {
            throw new Error(
                "Access denied: only uploader can delete attachment",
            );
        }

        const now = Date.now();

        await ctx.db.patch(args.attachmentId, {
            deletedAt: now,
            deletedBy: user._id,
        });

        // Note: We don't delete from storage immediately.
        // Could add a cleanup job later to remove orphaned storage files.

        // Audit log
        await logAudit(ctx, {
            workspaceId: chat.workspaceId,
            userId: user._id,
            action: "attachment.delete",
            entityType: "attachment",
            entityId: args.attachmentId,
            metadata: {
                chatId: attachment.chatId,
                filename: attachment.filename,
            },
        });

        return { success: true };
    },
});

// ============================================================
// Queries
// ============================================================

/**
 * Get a download URL for an attachment
 * Returns null if attachment not found or user doesn't have access
 */
export const getUrl = query({
    args: {
        clerkId: v.string(),
        attachmentId: v.id("attachments"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        const attachment = await ctx.db.get(args.attachmentId);
        if (!attachment || attachment.deletedAt) {
            return null;
        }

        // Verify chat access
        await assertCanAccessChat(ctx, attachment.chatId, user._id);

        // Get the download URL from storage
        const url = await ctx.storage.getUrl(attachment.storageId);

        return {
            url,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
        };
    },
});

/**
 * List all attachments for a chat
 * Includes download URLs for each attachment
 */
export const listForChat = query({
    args: {
        clerkId: v.string(),
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify chat access
        await assertCanAccessChat(ctx, args.chatId, user._id);

        const attachments = await ctx.db
            .query("attachments")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        // Get URLs for all attachments in parallel
        const attachmentsWithUrls = await Promise.all(
            attachments.map(async (att) => ({
                ...att,
                url: await ctx.storage.getUrl(att.storageId),
            })),
        );

        // Sort by creation time (most recent first)
        return attachmentsWithUrls.sort((a, b) => b.createdAt - a.createdAt);
    },
});

/**
 * List attachments for a specific message
 */
export const listForMessage = query({
    args: {
        clerkId: v.string(),
        messageId: v.id("messages"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Get the message to find its chat
        const message = await ctx.db.get(args.messageId);
        if (!message || message.deletedAt) {
            return [];
        }

        // Verify chat access
        await assertCanAccessChat(ctx, message.chatId, user._id);

        const attachments = await ctx.db
            .query("attachments")
            .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        // Get URLs for all attachments in parallel
        const attachmentsWithUrls = await Promise.all(
            attachments.map(async (att) => ({
                ...att,
                url: await ctx.storage.getUrl(att.storageId),
            })),
        );

        return attachmentsWithUrls.sort((a, b) => a.createdAt - b.createdAt);
    },
});

/**
 * Get attachment count for a chat (for display purposes)
 */
export const countForChat = query({
    args: {
        clerkId: v.string(),
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify chat access
        await assertCanAccessChat(ctx, args.chatId, user._id);

        const attachments = await ctx.db
            .query("attachments")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        return attachments.length;
    },
});
