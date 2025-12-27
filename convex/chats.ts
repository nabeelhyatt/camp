import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
    getUserByClerkIdOrThrow,
    assertCanAccessWorkspace,
    assertCanAccessChat,
    assertCanAccessProject,
    canDeleteChat,
    countChildForks,
    getDescendantChatIds,
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
            creator: creator
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
                q.eq("workspaceId", args.workspaceId).eq("visibility", "private"),
            )
            .filter((q) =>
                q.and(
                    q.eq(q.field("deletedAt"), undefined),
                    q.eq(q.field("createdBy"), user._id),
                ),
            )
            .collect();

        // Get parent chat info for each fork
        const forksWithParent = await Promise.all(
            privateForks.map(async (fork) => {
                let parentChat = null;
                if (fork.parentChatId) {
                    const parent = await ctx.db.get(fork.parentChatId);
                    if (parent && !parent.deletedAt) {
                        parentChat = {
                            id: parent._id,
                            title: parent.title,
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

        const chatId = await ctx.db.insert("chats", {
            workspaceId: parentChat.workspaceId,
            projectId: parentChat.projectId,
            title:
                args.title?.trim() ??
                `Private exploration from ${parentChat.title ?? "chat"}`,
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
 * Cascades to all forks with warning
 */
export const remove = mutation({
    args: {
        clerkId: v.string(),
        chatId: v.id("chats"),
        confirmCascade: v.optional(v.boolean()),
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

        // Check for child forks
        const forkCount = await countChildForks(ctx, args.chatId);

        if (forkCount > 0 && !args.confirmCascade) {
            // Return warning instead of deleting
            return {
                success: false,
                requiresConfirmation: true,
                forkCount,
                message: `This will delete ${forkCount} private fork(s) from other team members.`,
            };
        }

        const now = Date.now();

        // Get all descendants for cascade delete
        const descendantIds = await getDescendantChatIds(ctx, args.chatId);

        // Soft delete the chat
        await ctx.db.patch(args.chatId, {
            deletedAt: now,
            deletedBy: user._id,
        });

        // Soft delete all descendants
        for (const descendantId of descendantIds) {
            await ctx.db.patch(descendantId, {
                deletedAt: now,
                deletedBy: user._id,
            });
        }

        // Audit log
        await logAudit(ctx, {
            workspaceId: chat.workspaceId,
            userId: user._id,
            action: "chat.delete",
            entityType: "chat",
            entityId: args.chatId,
            metadata: {
                forksDeleted: descendantIds.length,
            },
        });

        return {
            success: true,
            forksDeleted: descendantIds.length,
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
