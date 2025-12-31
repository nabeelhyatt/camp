import { QueryCtx, MutationCtx } from "../_generated/server";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";

/**
 * Centralized permission checks for Camp multiplayer
 *
 * All access control flows through these functions to ensure consistency.
 * The permission model:
 * - Workspace membership grants access to team-visible content
 * - Private content is only visible to its creator
 * - Admins can manage workspace settings but cannot see others' private content
 */

// ============================================================
// User Resolution
// ============================================================

/**
 * Get user by Clerk ID, throwing if not found
 */
export async function getUserByClerkIdOrThrow(
    ctx: QueryCtx | MutationCtx,
    clerkId: string,
): Promise<Doc<"users">> {
    const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .first();

    if (!user || user.deletedAt) {
        throw new Error("User not found");
    }

    return user;
}

/**
 * Internal query to get user by Clerk ID (for HTTP actions)
 * Returns null if not found instead of throwing
 */
export const getUserByClerkId = internalQuery({
    args: {
        clerkId: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .first();

        if (!user || user.deletedAt) {
            return null;
        }

        return user;
    },
});

/**
 * Internal query to check chat access (for HTTP actions)
 * Returns { allowed: true, chat } or { allowed: false, reason }
 */
export const checkChatAccess = internalQuery({
    args: {
        chatId: v.id("chats"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const chat = await ctx.db.get(args.chatId);

        if (!chat || chat.deletedAt) {
            return { allowed: false, reason: "chat_not_found" };
        }

        // Private chats: only creator can access
        if (chat.visibility === "private") {
            if (chat.createdBy !== args.userId) {
                return { allowed: false, reason: "private_chat" };
            }
            return { allowed: true, chat };
        }

        // Team chats: check workspace membership
        const membership = await ctx.db
            .query("workspaceMembers")
            .withIndex("by_workspace_and_user", (q) =>
                q.eq("workspaceId", chat.workspaceId).eq("userId", args.userId),
            )
            .first();

        if (!membership || membership.deletedAt) {
            return { allowed: false, reason: "not_workspace_member" };
        }

        return { allowed: true, chat };
    },
});

/**
 * Get user by Convex ID, throwing if not found
 */
export async function getUserOrThrow(
    ctx: QueryCtx | MutationCtx,
    userId: Id<"users">,
): Promise<Doc<"users">> {
    const user = await ctx.db.get(userId);

    if (!user || user.deletedAt) {
        throw new Error("User not found");
    }

    return user;
}

// ============================================================
// Workspace Access
// ============================================================

/**
 * Check if user is a member of a workspace
 */
export async function isWorkspaceMember(
    ctx: QueryCtx | MutationCtx,
    workspaceId: Id<"workspaces">,
    userId: Id<"users">,
): Promise<boolean> {
    const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_and_user", (q) =>
            q.eq("workspaceId", workspaceId).eq("userId", userId),
        )
        .first();

    return membership !== null && !membership.deletedAt;
}

/**
 * Get workspace membership with role, or null if not a member
 */
export async function getWorkspaceMembership(
    ctx: QueryCtx | MutationCtx,
    workspaceId: Id<"workspaces">,
    userId: Id<"users">,
): Promise<Doc<"workspaceMembers"> | null> {
    const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_and_user", (q) =>
            q.eq("workspaceId", workspaceId).eq("userId", userId),
        )
        .first();

    if (!membership || membership.deletedAt) {
        return null;
    }

    return membership;
}

/**
 * Assert user can access workspace, throwing if not
 */
export async function assertCanAccessWorkspace(
    ctx: QueryCtx | MutationCtx,
    workspaceId: Id<"workspaces">,
    userId: Id<"users">,
): Promise<Doc<"workspaceMembers">> {
    const membership = await getWorkspaceMembership(ctx, workspaceId, userId);

    if (!membership) {
        throw new Error("Access denied: not a workspace member");
    }

    return membership;
}

/**
 * Check if user is an admin (owner or admin role) of a workspace
 */
export async function isWorkspaceAdmin(
    ctx: QueryCtx | MutationCtx,
    workspaceId: Id<"workspaces">,
    userId: Id<"users">,
): Promise<boolean> {
    const membership = await getWorkspaceMembership(ctx, workspaceId, userId);

    if (!membership) {
        return false;
    }

    return membership.role === "owner" || membership.role === "admin";
}

/**
 * Assert user is an admin of workspace, throwing if not
 */
export async function assertIsWorkspaceAdmin(
    ctx: QueryCtx | MutationCtx,
    workspaceId: Id<"workspaces">,
    userId: Id<"users">,
): Promise<Doc<"workspaceMembers">> {
    const membership = await getWorkspaceMembership(ctx, workspaceId, userId);

    if (!membership) {
        throw new Error("Access denied: not a workspace member");
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
        throw new Error("Access denied: admin privileges required");
    }

    return membership;
}

// ============================================================
// Project Access
// ============================================================

/**
 * Check if user can access a project
 * For now, all projects in a workspace are visible to all members (team visibility)
 * Phase 4 will add shared/private visibility
 */
export async function canAccessProject(
    ctx: QueryCtx | MutationCtx,
    projectId: Id<"projects">,
    userId: Id<"users">,
): Promise<boolean> {
    const project = await ctx.db.get(projectId);

    if (!project || project.deletedAt) {
        return false;
    }

    // Check workspace membership
    return isWorkspaceMember(ctx, project.workspaceId, userId);
}

/**
 * Assert user can access project, throwing if not
 */
export async function assertCanAccessProject(
    ctx: QueryCtx | MutationCtx,
    projectId: Id<"projects">,
    userId: Id<"users">,
): Promise<Doc<"projects">> {
    const project = await ctx.db.get(projectId);

    if (!project || project.deletedAt) {
        throw new Error("Project not found");
    }

    await assertCanAccessWorkspace(ctx, project.workspaceId, userId);

    return project;
}

// ============================================================
// Chat Access
// ============================================================

/**
 * Check if user can access a chat
 * Considers visibility: team chats visible to all workspace members,
 * private chats only visible to creator
 */
export async function canAccessChat(
    ctx: QueryCtx | MutationCtx,
    chatId: Id<"chats">,
    userId: Id<"users">,
): Promise<boolean> {
    const chat = await ctx.db.get(chatId);

    if (!chat || chat.deletedAt) {
        return false;
    }

    // Private chats: only creator can access
    if (chat.visibility === "private") {
        return chat.createdBy === userId;
    }

    // Team chats (default): check workspace membership
    return isWorkspaceMember(ctx, chat.workspaceId, userId);
}

/**
 * Assert user can access chat, throwing if not
 */
export async function assertCanAccessChat(
    ctx: QueryCtx | MutationCtx,
    chatId: Id<"chats">,
    userId: Id<"users">,
): Promise<Doc<"chats">> {
    const chat = await ctx.db.get(chatId);

    if (!chat || chat.deletedAt) {
        throw new Error("Chat not found");
    }

    // Private chats: only creator can access
    if (chat.visibility === "private") {
        if (chat.createdBy !== userId) {
            throw new Error("Access denied: private chat");
        }
        return chat;
    }

    // Team chats: check workspace membership
    await assertCanAccessWorkspace(ctx, chat.workspaceId, userId);

    return chat;
}

/**
 * Check if user can delete a chat
 * Creator can always delete, admins can delete team chats
 */
export async function canDeleteChat(
    ctx: QueryCtx | MutationCtx,
    chatId: Id<"chats">,
    userId: Id<"users">,
): Promise<boolean> {
    const chat = await ctx.db.get(chatId);

    if (!chat || chat.deletedAt) {
        return false;
    }

    // Creator can always delete
    if (chat.createdBy === userId) {
        return true;
    }

    // Private chats: only creator (handled above)
    if (chat.visibility === "private") {
        return false;
    }

    // Team chats: admins can delete
    return isWorkspaceAdmin(ctx, chat.workspaceId, userId);
}

// ============================================================
// Message Access
// ============================================================

/**
 * Assert user can access a message (via chat access)
 */
export async function assertCanAccessMessage(
    ctx: QueryCtx | MutationCtx,
    messageId: Id<"messages">,
    userId: Id<"users">,
): Promise<Doc<"messages">> {
    const message = await ctx.db.get(messageId);

    if (!message || message.deletedAt) {
        throw new Error("Message not found");
    }

    // Check chat access
    await assertCanAccessChat(ctx, message.chatId, userId);

    return message;
}

// ============================================================
// Fork Access
// ============================================================

/**
 * Count child forks of a chat (for deletion warning)
 */
export async function countChildForks(
    ctx: QueryCtx | MutationCtx,
    chatId: Id<"chats">,
): Promise<number> {
    const forks = await ctx.db
        .query("chats")
        .withIndex("by_parent_chat", (q) => q.eq("parentChatId", chatId))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

    return forks.length;
}

/**
 * Get all descendant chat IDs in a fork chain (for cascade delete)
 */
export async function getDescendantChatIds(
    ctx: QueryCtx | MutationCtx,
    chatId: Id<"chats">,
): Promise<Id<"chats">[]> {
    const descendants: Id<"chats">[] = [];

    // BFS to find all descendants
    const queue: Id<"chats">[] = [chatId];

    while (queue.length > 0) {
        const currentId = queue.shift()!;

        const children = await ctx.db
            .query("chats")
            .withIndex("by_parent_chat", (q) => q.eq("parentChatId", currentId))
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        for (const child of children) {
            descendants.push(child._id);
            queue.push(child._id);
        }
    }

    return descendants;
}
