import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
    getUserByClerkIdOrThrow,
    assertCanAccessWorkspace,
    assertCanAccessChat,
    assertCanAccessProject,
    canDeleteChat,
} from "./lib/permissions";
import { logAudit } from "./lib/audit";

/**
 * Chat CRUD operations for Camp multiplayer
 *
 * Chats are conversation containers within a workspace.
 * Supports:
 * - Team chats (visible to all workspace members)
 * - Private chats/forks (visible only to creator)
 * - Branching from existing chats
 */

// ============================================================
// Queries
// ============================================================

/**
 * List all chats in a workspace that the user can access
 * Includes both team chats and user's own private chats
 */
export const list = query({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
        projectId: v.optional(v.id("projects")),
        includeAmbient: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify workspace access
        await assertCanAccessWorkspace(ctx, args.workspaceId, user._id);

        // Build query based on filters
        let chatsQuery;

        if (args.projectId) {
            // Verify project belongs to this workspace
            const project = await assertCanAccessProject(
                ctx,
                args.projectId,
                user._id,
            );
            if (project.workspaceId !== args.workspaceId) {
                throw new Error("Access denied: project not in workspace");
            }
            chatsQuery = ctx.db
                .query("chats")
                .withIndex("by_project", (q) =>
                    q.eq("projectId", args.projectId),
                );
        } else {
            chatsQuery = ctx.db
                .query("chats")
                .withIndex("by_workspace", (q) =>
                    q.eq("workspaceId", args.workspaceId),
                );
        }

        const allChats = await chatsQuery
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        // Filter by access permissions
        const accessibleChats = allChats.filter((chat) => {
            // Filter out ambient if not requested
            if (!args.includeAmbient && chat.isAmbient) {
                return false;
            }

            // Team chats: visible to all
            if (!chat.visibility || chat.visibility === "team") {
                return true;
            }

            // Private chats: only visible to creator
            return chat.createdBy === user._id;
        });

        // Sort by most recent first
        return accessibleChats.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

/**
 * Get a single chat by ID
 */
export const get = query({
    args: {
        clerkId: v.string(),
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // This will throw if user can't access
        const chat = await assertCanAccessChat(ctx, args.chatId, user._id);

        return chat;
    },
});

/**
 * Get chat with creator info for attribution
 */
export const getWithCreator = query({
    args: {
        clerkId: v.string(),
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // This will throw if user can't access
        const chat = await assertCanAccessChat(ctx, args.chatId, user._id);

        // Get creator info
        const creator = await ctx.db.get(chat.createdBy);

        return {
            ...chat,
            creator:
                creator && !creator.deletedAt
                    ? {
                          id: creator._id,
                          displayName: creator.displayName,
                          avatarUrl: creator.avatarUrl,
                      }
                    : undefined,
        };
    },
});

/**
 * Get ungrouped chats (not in any project)
 */
export const listUngrouped = query({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
        includeAmbient: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify workspace access
        await assertCanAccessWorkspace(ctx, args.workspaceId, user._id);

        const chats = await ctx.db
            .query("chats")
            .withIndex("by_workspace", (q) =>
                q.eq("workspaceId", args.workspaceId),
            )
            .filter((q) =>
                q.and(
                    q.eq(q.field("deletedAt"), undefined),
                    q.eq(q.field("projectId"), undefined),
                ),
            )
            .collect();

        // Filter by access and ambient preference
        const accessibleChats = chats.filter((chat) => {
            if (!args.includeAmbient && chat.isAmbient) {
                return false;
            }

            if (!chat.visibility || chat.visibility === "team") {
                return true;
            }

            return chat.createdBy === user._id;
        });

        return accessibleChats.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

/**
 * Get user's private forks
 *
 * Returns parent chat info including whether it was deleted.
 * If parent is deleted, parentChat.isDeleted will be true.
 */
export const listPrivateForks = query({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify workspace access
        await assertCanAccessWorkspace(ctx, args.workspaceId, user._id);

        // Get user's private chats
        const privateForks = await ctx.db
            .query("chats")
            .withIndex("by_workspace_and_visibility", (q) =>
                q
                    .eq("workspaceId", args.workspaceId)
                    .eq("visibility", "private"),
            )
            .filter((q) =>
                q.and(
                    q.eq(q.field("deletedAt"), undefined),
                    q.eq(q.field("createdBy"), user._id),
                ),
            )
            .collect();

        // Get parent chat info for each fork (including deleted state)
        const forksWithParent = await Promise.all(
            privateForks.map(async (fork) => {
                let parentChat = null;
                if (fork.parentChatId) {
                    const parent = await ctx.db.get(fork.parentChatId);
                    if (parent) {
                        parentChat = {
                            id: parent._id,
                            title: parent.title,
                            isDeleted: !!parent.deletedAt,
                        };
                    }
                }

                return {
                    ...fork,
                    parentChat,
                };
            }),
        );

        return forksWithParent.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

// ============================================================
// Mutations
// ============================================================

/**
 * Create a new chat
 */
export const create = mutation({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
        projectId: v.optional(v.id("projects")),
        title: v.optional(v.string()),
        isAmbient: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify workspace access
        await assertCanAccessWorkspace(ctx, args.workspaceId, user._id);

        // If projectId provided, verify project access
        if (args.projectId) {
            await assertCanAccessProject(ctx, args.projectId, user._id);
        }

        const now = Date.now();

        const chatId = await ctx.db.insert("chats", {
            workspaceId: args.workspaceId,
            projectId: args.projectId,
            title: args.title?.trim(),
            createdBy: user._id,
            isAmbient: args.isAmbient ?? false,
            visibility: "team", // Default to team visibility
            forkDepth: 0, // Root chat
            createdAt: now,
            updatedAt: now,
        });

        // Audit log
        await logAudit(ctx, {
            workspaceId: args.workspaceId,
            userId: user._id,
            action: "chat.create",
            entityType: "chat",
            entityId: chatId,
            metadata: {
                title: args.title,
                projectId: args.projectId,
                isAmbient: args.isAmbient,
            },
        });

        return chatId;
    },
});

/**
 * Create a private fork from a team chat
 * This is the "Reply privately" feature
 *
 * When forkFromMessageId is provided:
 * 1. Creates a new private chat
 * 2. Copies all message sets up to and including the forked message
 * 3. Sets branchedFromId on the copied message to link back to original
 * 4. Updates the original message with replyChatId
 */
export const createPrivateFork = mutation({
    args: {
        clerkId: v.string(),
        parentChatId: v.id("chats"),
        forkFromMessageId: v.optional(v.id("messages")),
        title: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify access to parent chat
        const parentChat = await assertCanAccessChat(
            ctx,
            args.parentChatId,
            user._id,
        );

        const now = Date.now();

        // Calculate fork depth
        const forkDepth = (parentChat.forkDepth ?? 0) + 1;

        // Determine root chat (for chain queries)
        const rootChatId = parentChat.rootChatId ?? parentChat._id;

        // Title is optional - if not provided, the UI will display the parent chat title
        const chatId = await ctx.db.insert("chats", {
            workspaceId: parentChat.workspaceId,
            projectId: parentChat.projectId,
            title: args.title?.trim() || undefined,
            createdBy: user._id,
            isAmbient: false,
            parentChatId: args.parentChatId,
            visibility: "private", // Private fork
            forkFromMessageId: args.forkFromMessageId,
            forkDepth,
            rootChatId,
            createdAt: now,
            updatedAt: now,
        });

        // If we have a forkFromMessageId, copy messages up to that point
        if (args.forkFromMessageId) {
            // Get the forked message to find its message set
            const forkedMessage = await ctx.db.get(args.forkFromMessageId);
            if (!forkedMessage) {
                throw new Error("Forked message not found");
            }
            // Validate that the forked message belongs to the parent chat
            if (forkedMessage.chatId !== args.parentChatId) {
                throw new Error("Forked message is not in the parent chat");
            }

            // Get the forked message's message set to find its creation time
            const forkedMessageSet = await ctx.db.get(
                forkedMessage.messageSetId,
            );
            if (!forkedMessageSet || forkedMessageSet.deletedAt) {
                throw new Error("Forked message set not found or deleted");
            }

            // Get all message sets in the parent chat up to and including the forked one
            const parentMessageSets = await ctx.db
                .query("messageSets")
                .withIndex("by_chat", (q) => q.eq("chatId", args.parentChatId))
                .filter((q) =>
                    q.and(
                        q.eq(q.field("deletedAt"), undefined),
                        q.lte(q.field("createdAt"), forkedMessageSet.createdAt),
                    ),
                )
                .collect();

            // Sort by creation time to maintain order
            const sortedMessageSets = parentMessageSets.sort(
                (a, b) => a.createdAt - b.createdAt,
            );

            // Copy each message set and its messages
            for (const sourceSet of sortedMessageSets) {
                // Create new message set in the fork
                const newMessageSetId = await ctx.db.insert("messageSets", {
                    chatId,
                    createdBy: sourceSet.createdBy,
                    createdAt: sourceSet.createdAt,
                    authorSnapshot: sourceSet.authorSnapshot,
                });

                // Get all messages in this set
                const sourceMessages = await ctx.db
                    .query("messages")
                    .withIndex("by_message_set", (q) =>
                        q.eq("messageSetId", sourceSet._id),
                    )
                    .filter((q) => q.eq(q.field("deletedAt"), undefined))
                    .collect();

                // Copy each message
                for (const sourceMessage of sourceMessages) {
                    // Determine if this is the message being forked from
                    const isForkedMessage =
                        sourceMessage._id === args.forkFromMessageId;

                    // Create new message
                    const newMessageId = await ctx.db.insert("messages", {
                        messageSetId: newMessageSetId,
                        chatId,
                        role: sourceMessage.role,
                        model: sourceMessage.model,
                        status: "complete", // Reset status to complete
                        errorMessage: undefined,
                        streamingSessionId: undefined,
                        // Link back to original if this is the forked message
                        branchedFromId: isForkedMessage
                            ? args.forkFromMessageId
                            : undefined,
                        selected: sourceMessage.selected ?? true,
                        createdAt: sourceMessage.createdAt,
                        updatedAt: now,
                    });

                    // Get and copy message parts
                    const sourceParts = await ctx.db
                        .query("messageParts")
                        .withIndex("by_message", (q) =>
                            q.eq("messageId", sourceMessage._id),
                        )
                        .filter((q) => q.eq(q.field("deletedAt"), undefined))
                        .collect();

                    for (const sourcePart of sourceParts) {
                        await ctx.db.insert("messageParts", {
                            messageId: newMessageId,
                            type: sourcePart.type,
                            content: sourcePart.content,
                            language: sourcePart.language,
                            toolName: sourcePart.toolName,
                            toolCallId: sourcePart.toolCallId,
                            order: sourcePart.order,
                            createdAt: sourcePart.createdAt,
                        });
                    }
                }
            }

            // Update the original message with replyChatId
            await ctx.db.patch(args.forkFromMessageId, {
                replyChatId: chatId,
            });
        }

        // Audit log
        await logAudit(ctx, {
            workspaceId: parentChat.workspaceId,
            userId: user._id,
            action: "chat.fork",
            entityType: "chat",
            entityId: chatId,
            metadata: {
                parentChatId: args.parentChatId,
                forkFromMessageId: args.forkFromMessageId,
                visibility: "private",
                forkDepth,
                messagesCopied: args.forkFromMessageId ? true : false,
            },
        });

        return chatId;
    },
});

/**
 * Update a chat's title
 */
export const update = mutation({
    args: {
        clerkId: v.string(),
        chatId: v.id("chats"),
        title: v.optional(v.string()),
        projectId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify access
        const chat = await assertCanAccessChat(ctx, args.chatId, user._id);

        const updates: Record<string, unknown> = {
            updatedAt: Date.now(),
        };

        if (args.title !== undefined) {
            updates.title = args.title.trim() || undefined;
        }

        if (args.projectId !== undefined) {
            // Verify project access if moving to a project
            if (args.projectId) {
                await assertCanAccessProject(ctx, args.projectId, user._id);
            }
            updates.projectId = args.projectId;
        }

        await ctx.db.patch(args.chatId, updates);

        // Audit log
        await logAudit(ctx, {
            workspaceId: chat.workspaceId,
            userId: user._id,
            action: "chat.update",
            entityType: "chat",
            entityId: args.chatId,
            metadata: { updates },
        });

        return args.chatId;
    },
});

/**
 * Delete a chat (soft delete)
 *
 * Deletion behavior:
 * - Private forks are NOT cascade deleted - they remain accessible with
 *   a "[Deleted]" indicator for the parent chat
 * - Only shows warning if chat is a team chat with multiple users involved
 *   (future: show profile icons of other users)
 */
export const remove = mutation({
    args: {
        clerkId: v.string(),
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify access
        const chat = await assertCanAccessChat(ctx, args.chatId, user._id);

        // Check if user can delete
        const canDelete = await canDeleteChat(ctx, args.chatId, user._id);
        if (!canDelete) {
            throw new Error(
                "Access denied: only creator or admin can delete chats",
            );
        }

        const now = Date.now();

        // Soft delete the chat only (private forks remain accessible)
        await ctx.db.patch(args.chatId, {
            deletedAt: now,
            deletedBy: user._id,
        });

        // Note: Private forks keep their parentChatId reference
        // The listPrivateForks query will show "[Deleted]" for orphaned parents

        // Audit log
        await logAudit(ctx, {
            workspaceId: chat.workspaceId,
            userId: user._id,
            action: "chat.delete",
            entityType: "chat",
            entityId: args.chatId,
        });

        return {
            success: true,
        };
    },
});

/**
 * Publish a summary from a private fork back to the parent chat
 */
export const publishSummary = mutation({
    args: {
        clerkId: v.string(),
        chatId: v.id("chats"), // The private fork
        summary: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify access to the fork
        const fork = await assertCanAccessChat(ctx, args.chatId, user._id);

        // Must be a private fork with a parent
        if (fork.visibility !== "private" || !fork.parentChatId) {
            throw new Error("Can only publish summaries from private forks");
        }

        // Verify we can access the parent
        const parentChat = await assertCanAccessChat(
            ctx,
            fork.parentChatId,
            user._id,
        );

        const now = Date.now();

        // Create a message set in the parent chat with the summary
        const messageSetId = await ctx.db.insert("messageSets", {
            chatId: fork.parentChatId,
            createdBy: user._id,
            createdAt: now,
            authorSnapshot: {
                userId: user._id,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
            },
        });

        // Create the summary message
        const messageId = await ctx.db.insert("messages", {
            messageSetId,
            chatId: fork.parentChatId,
            role: "user",
            status: "complete",
            createdAt: now,
            updatedAt: now,
        });

        // Create the message content
        await ctx.db.insert("messageParts", {
            messageId,
            type: "text",
            content: `**Shared from private exploration:**\n\n${args.summary}`,
            order: 0,
            createdAt: now,
        });

        // Update parent chat's updatedAt
        await ctx.db.patch(fork.parentChatId, {
            updatedAt: now,
        });

        // Audit log
        await logAudit(ctx, {
            workspaceId: parentChat.workspaceId,
            userId: user._id,
            action: "chat.publish_summary",
            entityType: "chat",
            entityId: args.chatId,
            metadata: {
                parentChatId: fork.parentChatId,
                summaryLength: args.summary.length,
            },
        });

        return {
            success: true,
            messageSetId,
            messageId,
        };
    },
});
