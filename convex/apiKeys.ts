import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import {
    getUserByClerkIdOrThrow,
    assertCanAccessWorkspace,
    assertIsWorkspaceAdmin,
} from "./lib/permissions";

/**
 * API Key Management for Camp Multiplayer
 *
 * Key resolution order:
 * 1. User's personal key for provider (future: userMcpSecrets table)
 * 2. Workspace's team key (apiKeys table)
 * 3. Default hardcoded key (from environment variables)
 *
 * Security:
 * - Keys are encrypted client-side before storage
 * - Decryption happens server-side in HTTP actions
 * - Key hints (last 4 chars) are stored for UI display
 */

// Provider identifiers matching the frontend ModelProviders
export const PROVIDERS = [
    "openai",
    "anthropic",
    "google",
    "openrouter",
    "perplexity",
    "grok",
    "ollama",
    "lmstudio",
] as const;

export type Provider = (typeof PROVIDERS)[number];

// ============================================================
// Queries
// ============================================================

/**
 * List all API keys for a workspace (without decrypted values)
 * Returns key hints for UI display, with sharer attribution
 */
export const listForWorkspace = query({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);
        await assertCanAccessWorkspace(ctx, args.workspaceId, user._id);

        const keys = await ctx.db
            .query("apiKeys")
            .withIndex("by_workspace", (q) =>
                q.eq("workspaceId", args.workspaceId),
            )
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        // Return without encrypted key values (only hints)
        return keys.map((key) => ({
            _id: key._id,
            provider: key.provider,
            keyHint: key.keyHint,
            createdBy: key.createdBy,
            createdAt: key.createdAt,
            updatedAt: key.updatedAt,
            // Phase 3: Sharer attribution
            sharedBy: key.sharedBy,
            sharerSnapshot: key.sharerSnapshot,
            isSharer: key.sharedBy === user._id,
        }));
    },
});

/**
 * Check if a workspace has a key configured for a provider
 */
export const hasKeyForProvider = query({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
        provider: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);
        await assertCanAccessWorkspace(ctx, args.workspaceId, user._id);

        const key = await ctx.db
            .query("apiKeys")
            .withIndex("by_workspace_and_provider", (q) =>
                q
                    .eq("workspaceId", args.workspaceId)
                    .eq("provider", args.provider),
            )
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .first();

        return key !== null;
    },
});

/**
 * Internal query to get decrypted key for a provider (used by HTTP actions)
 * This should only be called from server-side code
 */
export const getKeyForProvider = internalQuery({
    args: {
        workspaceId: v.id("workspaces"),
        provider: v.string(),
    },
    handler: async (ctx, args) => {
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("by_workspace_and_provider", (q) =>
                q
                    .eq("workspaceId", args.workspaceId)
                    .eq("provider", args.provider),
            )
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .first();

        if (!key) {
            return null;
        }

        return {
            encryptedKey: key.encryptedKey,
            provider: key.provider,
        };
    },
});

// ============================================================
// Mutations
// ============================================================

/**
 * Set or update a team API key (admin only)
 *
 * @param encryptedKey - Key encrypted client-side
 * @param keyHint - Last 4 characters for display
 */
export const setTeamKey = mutation({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
        provider: v.string(),
        encryptedKey: v.string(),
        keyHint: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);
        await assertIsWorkspaceAdmin(ctx, args.workspaceId, user._id);

        const now = Date.now();

        // Check if key already exists
        const existingKey = await ctx.db
            .query("apiKeys")
            .withIndex("by_workspace_and_provider", (q) =>
                q
                    .eq("workspaceId", args.workspaceId)
                    .eq("provider", args.provider),
            )
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .first();

        if (existingKey) {
            // Update existing key
            await ctx.db.patch(existingKey._id, {
                encryptedKey: args.encryptedKey,
                keyHint: args.keyHint,
                updatedAt: now,
            });
            return { _id: existingKey._id, updated: true };
        }

        // Create new key
        const keyId = await ctx.db.insert("apiKeys", {
            workspaceId: args.workspaceId,
            provider: args.provider,
            encryptedKey: args.encryptedKey,
            keyHint: args.keyHint,
            createdBy: user._id,
            createdAt: now,
            updatedAt: now,
        });

        return { _id: keyId, updated: false };
    },
});

/**
 * Delete a team API key (admin only)
 */
export const deleteTeamKey = mutation({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
        provider: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);
        await assertIsWorkspaceAdmin(ctx, args.workspaceId, user._id);

        const existingKey = await ctx.db
            .query("apiKeys")
            .withIndex("by_workspace_and_provider", (q) =>
                q
                    .eq("workspaceId", args.workspaceId)
                    .eq("provider", args.provider),
            )
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .first();

        if (!existingKey) {
            throw new Error("API key not found");
        }

        // Soft delete
        await ctx.db.patch(existingKey._id, {
            deletedAt: Date.now(),
            deletedBy: user._id,
        });

        return { success: true };
    },
});

// ============================================================
// Key Resolution (for streaming)
// ============================================================

/**
 * Internal function to resolve the best API key for a provider
 * Resolution order:
 * 1. User's shared key (sharedBy field set)
 * 2. Workspace's admin-set team key (no sharedBy field)
 * 3. null (caller should fall back to default)
 *
 * This is called by HTTP actions that need to make API calls
 */
export const resolveKeyForProvider = internalQuery({
    args: {
        workspaceId: v.id("workspaces"),
        userId: v.id("users"),
        provider: v.string(),
    },
    handler: async (ctx, args) => {
        // Get all keys for this provider in the workspace
        const keys = await ctx.db
            .query("apiKeys")
            .withIndex("by_workspace_and_provider", (q) =>
                q
                    .eq("workspaceId", args.workspaceId)
                    .eq("provider", args.provider),
            )
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        if (keys.length === 0) {
            return null;
        }

        // Prefer user's own shared key first
        const userKey = keys.find((k) => k.sharedBy === args.userId);
        if (userKey) {
            return {
                source: "user" as const,
                encryptedKey: userKey.encryptedKey,
            };
        }

        // Then any user-shared key
        const sharedKey = keys.find((k) => k.sharedBy !== undefined);
        if (sharedKey) {
            return {
                source: "shared" as const,
                encryptedKey: sharedKey.encryptedKey,
            };
        }

        // Finally admin-set team key
        const teamKey = keys.find((k) => k.sharedBy === undefined);
        if (teamKey) {
            return {
                source: "team" as const,
                encryptedKey: teamKey.encryptedKey,
            };
        }

        return null;
    },
});

// ============================================================
// Phase 3: User Sharing Mutations
// ============================================================

/**
 * Share an API key with the team (any member can share)
 * Creates a user-attributed key entry
 */
export const shareKey = mutation({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
        provider: v.string(),
        encryptedKey: v.string(),
        keyHint: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);
        await assertCanAccessWorkspace(ctx, args.workspaceId, user._id);

        const now = Date.now();

        // Check if this user already has a shared key for this provider
        const existingKeys = await ctx.db
            .query("apiKeys")
            .withIndex("by_workspace_and_provider", (q) =>
                q
                    .eq("workspaceId", args.workspaceId)
                    .eq("provider", args.provider),
            )
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

        const existingUserKey = existingKeys.find(
            (k) => k.sharedBy === user._id,
        );

        if (existingUserKey) {
            // Update existing key
            await ctx.db.patch(existingUserKey._id, {
                encryptedKey: args.encryptedKey,
                keyHint: args.keyHint,
                updatedAt: now,
                sharerSnapshot: {
                    userId: user._id,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl,
                },
            });
            return { _id: existingUserKey._id, updated: true };
        }

        // Create new shared key
        const keyId = await ctx.db.insert("apiKeys", {
            workspaceId: args.workspaceId,
            provider: args.provider,
            encryptedKey: args.encryptedKey,
            keyHint: args.keyHint,
            createdBy: user._id,
            createdAt: now,
            updatedAt: now,
            sharedBy: user._id,
            sharerSnapshot: {
                userId: user._id,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
            },
        });

        return { _id: keyId, updated: false };
    },
});

/**
 * Unshare a user's API key
 * Only the sharer can unshare their own key
 */
export const unshareKey = mutation({
    args: {
        clerkId: v.string(),
        keyId: v.id("apiKeys"),
    },
    handler: async (ctx, args) => {
        const user = await getUserByClerkIdOrThrow(ctx, args.clerkId);

        const key = await ctx.db.get(args.keyId);

        if (!key || key.deletedAt) {
            throw new Error("API key not found");
        }

        // Only the sharer can unshare
        if (key.sharedBy !== user._id) {
            throw new Error("Only the sharer can unshare this key");
        }

        // Soft delete
        await ctx.db.patch(args.keyId, {
            deletedAt: Date.now(),
            deletedBy: user._id,
        });

        return { success: true };
    },
});
