import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import {
    getUserByClerkIdOrThrow,
    assertCanAccessWorkspace,
} from "./lib/permissions";

/**
 * Team MCP Configuration Management for Camp Multiplayer
 *
 * This module handles sharing MCP configurations with team members.
 * Key features:
 * - Any workspace member can share their MCPs (no admin required)
 * - Sharer can choose to include credentials or not
 * - Users can add their own credentials to shared MCPs
 * - Immediate unshare removes from all teammates
 *
 * Resolution order for credentials:
 * 1. User's personal secrets (mcpUserSecrets table)
 * 2. Sharer's credentials (if includeCredentials=true)
 * 3. None → MCP shows "Setup required" badge
 */

// MCP name validation regex (same as frontend)
const MCP_NAME_REGEX = /^[a-z0-9-]+$/;

// ============================================================
// Queries
// ============================================================

/**
 * List all team MCPs for a workspace
 * Returns MCPs with needsSetup flag based on credential availability
 */
export const listForWorkspace = query({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);
        await assertCanAccessWorkspace(ctx, args.workspaceId, user._id);

        // Get all team MCPs for this workspace
        const mcps = await ctx.db
            .query("mcpConfigs")
            .withIndex("by_workspace", (q) =>
                q.eq("workspaceId", args.workspaceId),
            )
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        // Get user's secrets for these MCPs
        const userSecrets = await ctx.db
            .query("mcpUserSecrets")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

        const userSecretsMap = new Map(
            userSecrets.map((s) => [s.mcpConfigId, s]),
        );

        // Determine setup status for each MCP
        return mcps.map((mcp) => {
            const userSecret = userSecretsMap.get(mcp._id);
            const hasUserCredentials = !!userSecret?.encryptedEnv;
            const hasSharerCredentials =
                mcp.includeCredentials && !!mcp.config.env;

            // MCP needs setup if no credentials available
            const needsSetup = !hasUserCredentials && !hasSharerCredentials;

            // Is this user the sharer?
            const isSharer = mcp.sharedBy === user._id;

            return {
                _id: mcp._id,
                name: mcp.name,
                type: mcp.type,
                config: {
                    command: mcp.config.command,
                    args: mcp.config.args,
                    // Only include env if user has access to credentials
                    hasEnv: hasUserCredentials || hasSharerCredentials,
                },
                enabled: mcp.enabled,
                sharedBy: mcp.sharedBy,
                sharerSnapshot: mcp.sharerSnapshot,
                includeCredentials: mcp.includeCredentials,
                createdAt: mcp.createdAt,
                updatedAt: mcp.updatedAt,
                // Computed fields
                needsSetup,
                isSharer,
                hasUserCredentials,
            };
        });
    },
});

/**
 * Get user's secrets for shared MCPs (for credential resolution)
 */
export const getUserSecrets = query({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);
        await assertCanAccessWorkspace(ctx, args.workspaceId, user._id);

        // Get all user secrets
        const secrets = await ctx.db
            .query("mcpUserSecrets")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

        // Filter to only secrets for MCPs in this workspace
        const mcpIds = secrets.map((s) => s.mcpConfigId);
        const mcps = await Promise.all(mcpIds.map((id) => ctx.db.get(id)));

        return secrets.filter((_secret, i) => {
            const mcp = mcps[i];
            return (
                mcp && !mcp.deletedAt && mcp.workspaceId === args.workspaceId
            );
        });
    },
});

/**
 * Internal query to get MCP credentials for runtime
 * Used by TeamToolsetsWrapper to resolve credentials
 */
export const getMcpCredentials = internalQuery({
    args: {
        mcpConfigId: v.id("mcpConfigs"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const mcp = await ctx.db.get(args.mcpConfigId);

        if (!mcp || mcp.deletedAt) {
            return null;
        }

        // Check user's own credentials first
        const userSecret = await ctx.db
            .query("mcpUserSecrets")
            .withIndex("by_user_and_mcp", (q) =>
                q.eq("userId", args.userId).eq("mcpConfigId", args.mcpConfigId),
            )
            .first();

        if (userSecret?.encryptedEnv) {
            return {
                source: "user" as const,
                encryptedEnv: userSecret.encryptedEnv,
            };
        }

        // Fall back to sharer's credentials
        if (mcp.includeCredentials && mcp.config.env) {
            return {
                source: "sharer" as const,
                encryptedEnv: mcp.config.env,
            };
        }

        // No credentials available
        return null;
    },
});

// ============================================================
// Mutations
// ============================================================

/**
 * Share an MCP with the team
 * Any workspace member can share (no admin required)
 */
export const shareMcp = mutation({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
        name: v.string(),
        type: v.union(v.literal("api"), v.literal("local")),
        command: v.string(),
        mcpArgs: v.string(), // renamed from 'args' to avoid conflict
        env: v.optional(v.string()), // JSON string of env vars
        includeCredentials: v.boolean(),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);
        await assertCanAccessWorkspace(ctx, args.workspaceId, user._id);

        // Validate MCP name
        if (!MCP_NAME_REGEX.test(args.name)) {
            throw new Error(
                "MCP name must be lowercase alphanumeric with dashes only",
            );
        }

        const now = Date.now();

        // Create sharer snapshot for attribution
        const sharerSnapshot = {
            userId: user._id,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
        };

        // Create the MCP config
        const mcpId = await ctx.db.insert("mcpConfigs", {
            workspaceId: args.workspaceId,
            name: args.name,
            type: args.type,
            config: {
                command: args.command,
                args: args.mcpArgs,
                // Only include env if sharing credentials
                env: args.includeCredentials ? args.env : undefined,
            },
            enabled: true,
            createdBy: user._id,
            createdAt: now,
            updatedAt: now,
            sharedBy: user._id,
            sharerSnapshot,
            includeCredentials: args.includeCredentials,
        });

        return { _id: mcpId };
    },
});

/**
 * Unshare an MCP (soft delete)
 * Only the sharer can unshare their own MCP, and they must still have workspace access
 */
export const unshareMcp = mutation({
    args: {
        clerkId: v.string(),
        mcpConfigId: v.id("mcpConfigs"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        const mcp = await ctx.db.get(args.mcpConfigId);

        if (!mcp || mcp.deletedAt) {
            throw new Error("MCP not found");
        }

        // Verify user still has workspace access
        await assertCanAccessWorkspace(ctx, mcp.workspaceId, user._id);

        // Only the sharer can unshare
        if (mcp.sharedBy !== user._id) {
            throw new Error("Only the sharer can unshare this MCP");
        }

        // Soft delete the MCP
        await ctx.db.patch(args.mcpConfigId, {
            deletedAt: Date.now(),
            deletedBy: user._id,
        });

        // Hard delete all user secrets for this MCP
        // (intentional: no audit trail needed for user secrets, and MCP is soft-deleted)
        const userSecrets = await ctx.db
            .query("mcpUserSecrets")
            .withIndex("by_mcp_config", (q) =>
                q.eq("mcpConfigId", args.mcpConfigId),
            )
            .collect();

        for (const secret of userSecrets) {
            await ctx.db.delete(secret._id);
        }

        return { success: true };
    },
});

/**
 * Update a shared MCP config
 * Only the sharer can update their own MCP
 */
export const updateSharedMcp = mutation({
    args: {
        clerkId: v.string(),
        mcpConfigId: v.id("mcpConfigs"),
        command: v.optional(v.string()),
        mcpArgs: v.optional(v.string()),
        env: v.optional(v.string()),
        includeCredentials: v.optional(v.boolean()),
        enabled: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        const mcp = await ctx.db.get(args.mcpConfigId);

        if (!mcp || mcp.deletedAt) {
            throw new Error("MCP not found");
        }

        // Only the sharer can update
        if (mcp.sharedBy !== user._id) {
            throw new Error("Only the sharer can update this MCP");
        }

        const updates: Record<string, unknown> = {
            updatedAt: Date.now(),
        };

        // Build config updates
        const configUpdates: Record<string, unknown> = {};

        if (args.command !== undefined) {
            configUpdates.command = args.command;
        }

        if (args.mcpArgs !== undefined) {
            configUpdates.args = args.mcpArgs;
        }

        // Handle credential update
        const newIncludeCredentials =
            args.includeCredentials ?? mcp.includeCredentials;

        if (args.includeCredentials !== undefined) {
            updates.includeCredentials = args.includeCredentials;
        }

        if (newIncludeCredentials && args.env !== undefined) {
            configUpdates.env = args.env;
        } else if (!newIncludeCredentials) {
            configUpdates.env = undefined;
        }

        if (Object.keys(configUpdates).length > 0) {
            updates.config = {
                ...mcp.config,
                ...configUpdates,
            };
        }

        if (args.enabled !== undefined) {
            updates.enabled = args.enabled;
        }

        // Update sharer snapshot in case user info changed
        updates.sharerSnapshot = {
            userId: user._id,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
        };

        await ctx.db.patch(args.mcpConfigId, updates);

        return { success: true };
    },
});

/**
 * Set user's personal credentials for a shared MCP
 */
export const setUserSecrets = mutation({
    args: {
        clerkId: v.string(),
        mcpConfigId: v.id("mcpConfigs"),
        encryptedEnv: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        const mcp = await ctx.db.get(args.mcpConfigId);

        if (!mcp || mcp.deletedAt) {
            throw new Error("MCP not found");
        }

        // Verify user has access to the workspace
        await assertCanAccessWorkspace(ctx, mcp.workspaceId, user._id);

        const now = Date.now();

        // Check if user already has secrets for this MCP
        const existingSecret = await ctx.db
            .query("mcpUserSecrets")
            .withIndex("by_user_and_mcp", (q) =>
                q.eq("userId", user._id).eq("mcpConfigId", args.mcpConfigId),
            )
            .first();

        if (existingSecret) {
            // Update existing secret
            await ctx.db.patch(existingSecret._id, {
                encryptedEnv: args.encryptedEnv,
                updatedAt: now,
            });
            return { _id: existingSecret._id, updated: true };
        }

        // Create new secret
        const secretId = await ctx.db.insert("mcpUserSecrets", {
            userId: user._id,
            mcpConfigId: args.mcpConfigId,
            encryptedEnv: args.encryptedEnv,
            createdAt: now,
            updatedAt: now,
        });

        return { _id: secretId, updated: false };
    },
});

/**
 * Delete user's personal credentials for a shared MCP
 */
export const deleteUserSecrets = mutation({
    args: {
        clerkId: v.string(),
        mcpConfigId: v.id("mcpConfigs"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        const secret = await ctx.db
            .query("mcpUserSecrets")
            .withIndex("by_user_and_mcp", (q) =>
                q.eq("userId", user._id).eq("mcpConfigId", args.mcpConfigId),
            )
            .first();

        if (!secret) {
            throw new Error("User secrets not found");
        }

        await ctx.db.delete(secret._id);

        return { success: true };
    },
});
