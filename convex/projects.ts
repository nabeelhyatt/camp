import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
    getUserByClerkIdOrThrow,
    assertCanAccessWorkspace,
    assertCanAccessProject,
    isWorkspaceAdmin,
} from "./lib/permissions";
import { logAudit } from "./lib/audit";

/**
 * Project CRUD operations for Camp multiplayer
 *
 * Projects are folders for organizing chats within a workspace.
 * All workspace members can see team projects.
 */

// ============================================================
// Queries
// ============================================================

/**
 * List all projects in a workspace that the user can access
 */
export const list = query({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify workspace access
        await assertCanAccessWorkspace(ctx, args.workspaceId, user._id);

        // Get all non-deleted projects in workspace
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_workspace", (q) =>
                q.eq("workspaceId", args.workspaceId),
            )
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        // Sort by most recent first
        return projects.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

/**
 * Get a single project by ID
 */
export const get = query({
    args: {
        clerkId: v.string(),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // This will throw if user can't access
        const project = await assertCanAccessProject(
            ctx,
            args.projectId,
            user._id,
        );

        return project;
    },
});

/**
 * Get projects with their chat counts
 */
export const listWithChatCounts = query({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify workspace access
        await assertCanAccessWorkspace(ctx, args.workspaceId, user._id);

        // Get all non-deleted projects in workspace
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_workspace", (q) =>
                q.eq("workspaceId", args.workspaceId),
            )
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        // Get chat counts for each project
        const projectsWithCounts = await Promise.all(
            projects.map(async (project) => {
                const chats = await ctx.db
                    .query("chats")
                    .withIndex("by_project", (q) =>
                        q.eq("projectId", project._id),
                    )
                    .filter((q) =>
                        q.and(
                            q.eq(q.field("deletedAt"), undefined),
                            // Only count team-visible chats (not private forks)
                            q.or(
                                q.eq(q.field("visibility"), undefined),
                                q.eq(q.field("visibility"), "team"),
                            ),
                        ),
                    )
                    .collect();

                return {
                    ...project,
                    chatCount: chats.length,
                };
            }),
        );

        // Sort by most recent first
        return projectsWithCounts.sort((a, b) => b.updatedAt - a.updatedAt);
    },
});

// ============================================================
// Mutations
// ============================================================

/**
 * Create a new project
 */
export const create = mutation({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
        name: v.string(),
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify workspace access
        await assertCanAccessWorkspace(ctx, args.workspaceId, user._id);

        const name = args.name.trim();
        if (!name) {
            throw new Error("Project name cannot be empty");
        }

        const now = Date.now();

        const projectId = await ctx.db.insert("projects", {
            workspaceId: args.workspaceId,
            name,
            description: args.description?.trim(),
            createdBy: user._id,
            createdAt: now,
            updatedAt: now,
        });

        // Audit log
        await logAudit(ctx, {
            workspaceId: args.workspaceId,
            userId: user._id,
            action: "project.create",
            entityType: "project",
            entityId: projectId,
            metadata: { name: args.name },
        });

        return projectId;
    },
});

/**
 * Update a project's name or description
 */
export const update = mutation({
    args: {
        clerkId: v.string(),
        projectId: v.id("projects"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify access
        const project = await assertCanAccessProject(
            ctx,
            args.projectId,
            user._id,
        );

        const updates: Record<string, unknown> = {
            updatedAt: Date.now(),
        };

        if (args.name !== undefined) {
            updates.name = args.name.trim();
        }

        if (args.description !== undefined) {
            updates.description = args.description.trim() || undefined;
        }

        await ctx.db.patch(args.projectId, updates);

        // Audit log
        await logAudit(ctx, {
            workspaceId: project.workspaceId,
            userId: user._id,
            action: "project.update",
            entityType: "project",
            entityId: args.projectId,
            metadata: { updates },
        });

        return args.projectId;
    },
});

/**
 * Soft delete a project
 * Only creator or workspace admin can delete
 */
export const remove = mutation({
    args: {
        clerkId: v.string(),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        // Verify access
        const project = await assertCanAccessProject(
            ctx,
            args.projectId,
            user._id,
        );

        // Check if user can delete (creator or admin)
        const isCreator = project.createdBy === user._id;
        const isAdmin = await isWorkspaceAdmin(
            ctx,
            project.workspaceId,
            user._id,
        );

        if (!isCreator && !isAdmin) {
            throw new Error(
                "Access denied: only creator or admin can delete projects",
            );
        }

        const now = Date.now();

        // Soft delete the project
        await ctx.db.patch(args.projectId, {
            deletedAt: now,
            deletedBy: user._id,
        });

        // Also soft delete all chats in this project
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        for (const chat of chats) {
            await ctx.db.patch(chat._id, {
                deletedAt: now,
                deletedBy: user._id,
            });
        }

        // Audit log
        await logAudit(ctx, {
            workspaceId: project.workspaceId,
            userId: user._id,
            action: "project.delete",
            entityType: "project",
            entityId: args.projectId,
            metadata: { chatsDeleted: chats.length },
        });

        return { success: true };
    },
});
