/**
 * Team API Keys API for Camp Multiplayer
 *
 * React hooks for managing team-shared API keys.
 * Uses Convex workspace queries and mutations for real-time data.
 *
 * Key features:
 * - List API keys with sharer attribution
 * - Share/unshare API keys with team
 * - Admin-set team keys (via setTeamKey)
 *
 * Key resolution order (in streaming):
 * 1. User's own shared key
 * 2. Most recently updated user-shared key
 * 3. Admin-set team key
 * 4. Default (from environment variables)
 */

import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import {
    useWorkspaceQuery,
    useWorkspaceMutation,
    useWorkspaceContext,
} from "./useWorkspaceHooks";
import { encryptApiKey, getKeyHint } from "./ApiKeyUtils";

// ============================================================
// Types
// ============================================================

export interface TeamApiKey {
    _id: Id<"apiKeys">;
    provider: string;
    keyHint: string;
    createdBy: Id<"users">;
    createdAt: number;
    updatedAt: number;
    // Phase 3: Sharer attribution
    sharedBy?: Id<"users">;
    sharerSnapshot?: {
        userId: Id<"users">;
        displayName: string;
        avatarUrl?: string;
    };
    isSharer: boolean;
}

export interface ShareApiKeyArgs {
    provider: string;
    apiKey: string;
}

// ============================================================
// Queries
// ============================================================

/**
 * List all API keys for the current workspace
 * Returns keys with sharer attribution (if user-shared)
 */
export function useTeamApiKeys(): TeamApiKey[] | undefined {
    return useWorkspaceQuery(api.apiKeys.listForWorkspace, {});
}

/**
 * Check if workspace has a key for a specific provider
 * Useful for showing "configured" badges in model picker
 */
export function useHasKeyForProvider(provider: string): boolean | undefined {
    return useWorkspaceQuery(api.apiKeys.hasKeyForProvider, { provider });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Share an API key with the team
 * Any workspace member can share (not admin-only)
 *
 * @param args.provider - Provider ID (e.g., "openai", "anthropic")
 * @param args.apiKey - The API key (will be encrypted before storage)
 */
export function useShareApiKey() {
    const shareKey = useWorkspaceMutation(api.apiKeys.shareKey);

    return async (
        args: ShareApiKeyArgs,
    ): Promise<{ _id: Id<"apiKeys">; updated: boolean }> => {
        const encryptedKey = encryptApiKey(args.apiKey);
        const keyHint = getKeyHint(args.apiKey);

        return shareKey({
            provider: args.provider,
            encryptedKey,
            keyHint,
        });
    };
}

/**
 * Unshare a user's API key
 * Only the sharer can unshare their own key
 */
export function useUnshareApiKey() {
    const { clerkId } = useWorkspaceContext();
    const unshareKey = useMutation(api.apiKeys.unshareKey);

    return async (keyId: Id<"apiKeys">): Promise<{ success: boolean }> => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }
        return unshareKey({ clerkId, keyId });
    };
}

/**
 * Set or update a team API key (admin only)
 * This creates an admin-set key (no sharedBy attribution)
 * Used for workspace-level default keys
 */
export function useSetTeamApiKey() {
    const setTeamKey = useWorkspaceMutation(api.apiKeys.setTeamKey);

    return async (
        provider: string,
        apiKey: string,
    ): Promise<{ _id: Id<"apiKeys">; updated: boolean }> => {
        const encryptedKey = encryptApiKey(apiKey);
        const keyHint = getKeyHint(apiKey);

        return setTeamKey({
            provider,
            encryptedKey,
            keyHint,
        });
    };
}

/**
 * Delete a team API key (admin only)
 * Removes the admin-set key for a provider
 */
export function useDeleteTeamApiKey() {
    const deleteKey = useWorkspaceMutation(api.apiKeys.deleteTeamKey);

    return async (provider: string): Promise<{ success: boolean }> => {
        return deleteKey({ provider });
    };
}

// ============================================================
// Query Keys (for cache invalidation)
// ============================================================

export const teamApiKeysKeys = {
    all: () => ["teamApiKeys"] as const,
    list: () => [...teamApiKeysKeys.all(), "list"] as const,
    forProvider: (provider: string) =>
        [...teamApiKeysKeys.all(), "provider", provider] as const,
};

// ============================================================
// Utilities
// ============================================================

/**
 * Get the provider display name
 */
export { getProviderDisplayName } from "./ApiKeyUtils";
