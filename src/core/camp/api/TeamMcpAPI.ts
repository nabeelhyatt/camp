/**
 * Team MCP API for Camp Multiplayer
 *
 * React hooks for managing team-shared MCP configurations.
 * Uses Convex workspace queries and mutations for real-time data.
 *
 * Key features:
 * - List team MCPs with setup status
 * - Share/unshare MCPs with team
 * - Set personal credentials for shared MCPs
 *
 * Credential resolution order:
 * 1. User's personal credentials (mcpUserSecrets)
 * 2. Sharer's credentials (if includeCredentials=true)
 * 3. None → MCP shows "Setup required" badge
 */

import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import {
    useWorkspaceQuery,
    useWorkspaceMutation,
    useWorkspaceContext,
} from "./useWorkspaceHooks";
import { encryptApiKey } from "./ApiKeyUtils";

// ============================================================
// Types
// ============================================================

export interface TeamMcpConfig {
    _id: Id<"mcpConfigs">;
    name: string;
    type: "api" | "local";
    config: {
        command: string;
        args: string;
        /** Encrypted env (base64) - resolved from user secrets or sharer credentials */
        encryptedEnv?: string;
        hasEnv?: boolean;
    };
    enabled: boolean;
    sharedBy?: Id<"users">;
    sharerSnapshot?: {
        userId: Id<"users">;
        displayName: string;
        avatarUrl?: string;
    };
    includeCredentials?: boolean;
    createdAt: number;
    updatedAt: number;
    // Computed fields
    needsSetup: boolean;
    isSharer: boolean;
    hasUserCredentials: boolean;
}

export interface ShareMcpArgs {
    name: string;
    type: "api" | "local";
    command: string;
    args: string;
    env?: string; // JSON string of env vars
    includeCredentials: boolean;
}

export interface UpdateMcpArgs {
    mcpConfigId: Id<"mcpConfigs">;
    command?: string;
    args?: string;
    env?: string;
    includeCredentials?: boolean;
    enabled?: boolean;
}

// ============================================================
// Queries
// ============================================================

/**
 * List all team MCPs for the current workspace
 * Returns MCPs with computed fields: needsSetup, isSharer, hasUserCredentials
 */
export function useTeamMcps(): TeamMcpConfig[] | undefined {
    return useWorkspaceQuery(api.mcpConfigs.listForWorkspace, {});
}

/**
 * Get user's personal secrets for team MCPs
 * Used to determine which MCPs the user has configured
 */
export function useUserMcpSecrets() {
    return useWorkspaceQuery(api.mcpConfigs.getUserSecrets, {});
}

// ============================================================
// Mutations
// ============================================================

/**
 * Share an MCP configuration with the team
 *
 * @param args.name - MCP name (lowercase alphanumeric with dashes)
 * @param args.type - "api" or "local"
 * @param args.command - Command to run
 * @param args.args - Command arguments
 * @param args.env - Environment variables (JSON string, only sent if includeCredentials=true)
 * @param args.includeCredentials - Whether to share credentials
 */
export function useShareMcp() {
    const shareMcp = useWorkspaceMutation(api.mcpConfigs.shareMcp);

    return async (args: ShareMcpArgs): Promise<{ _id: Id<"mcpConfigs"> }> => {
        // Encrypt env if provided
        const encryptedEnv = args.env ? encryptApiKey(args.env) : undefined;

        return shareMcp({
            name: args.name,
            type: args.type,
            command: args.command,
            mcpArgs: args.args,
            env: args.includeCredentials ? encryptedEnv : undefined,
            includeCredentials: args.includeCredentials,
        });
    };
}

/**
 * Unshare an MCP (soft delete)
 * Only the sharer can unshare their own MCP
 * This removes the MCP from all teammates immediately
 */
export function useUnshareMcp() {
    const { clerkId } = useWorkspaceContext();
    const unshareMcp = useMutation(api.mcpConfigs.unshareMcp);

    return async (
        mcpConfigId: Id<"mcpConfigs">,
    ): Promise<{ success: boolean }> => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }
        return unshareMcp({ clerkId, mcpConfigId });
    };
}

/**
 * Update a shared MCP configuration
 * Only the sharer can update their own MCP
 */
export function useUpdateSharedMcp() {
    const { clerkId } = useWorkspaceContext();
    const updateMcp = useMutation(api.mcpConfigs.updateSharedMcp);

    return async (args: UpdateMcpArgs): Promise<{ success: boolean }> => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }

        // Encrypt env if provided
        const encryptedEnv = args.env ? encryptApiKey(args.env) : undefined;

        return updateMcp({
            clerkId,
            mcpConfigId: args.mcpConfigId,
            command: args.command,
            mcpArgs: args.args,
            env: encryptedEnv,
            includeCredentials: args.includeCredentials,
            enabled: args.enabled,
        });
    };
}

/**
 * Set user's personal credentials for a shared MCP
 * Used when:
 * 1. MCP was shared without credentials (user needs to provide their own)
 * 2. User wants to use their own credentials instead of sharer's
 *
 * @param mcpConfigId - The MCP to set credentials for
 * @param env - Environment variables as JSON string (will be encrypted)
 */
export function useSetMcpUserSecrets() {
    const { clerkId } = useWorkspaceContext();
    const setSecrets = useMutation(api.mcpConfigs.setUserSecrets);

    return async (
        mcpConfigId: Id<"mcpConfigs">,
        env: string,
    ): Promise<{ _id: Id<"mcpUserSecrets">; updated: boolean }> => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }

        const encryptedEnv = encryptApiKey(env);
        return setSecrets({ clerkId, mcpConfigId, encryptedEnv });
    };
}

/**
 * Delete user's personal credentials for a shared MCP
 * Falls back to sharer's credentials (if available) or shows "Setup required"
 */
export function useDeleteMcpUserSecrets() {
    const { clerkId } = useWorkspaceContext();
    const deleteSecrets = useMutation(api.mcpConfigs.deleteUserSecrets);

    return async (
        mcpConfigId: Id<"mcpConfigs">,
    ): Promise<{ success: boolean }> => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }
        return deleteSecrets({ clerkId, mcpConfigId });
    };
}

// ============================================================
// Query Keys (for cache invalidation)
// ============================================================

export const teamMcpKeys = {
    all: () => ["teamMcps"] as const,
    list: () => [...teamMcpKeys.all(), "list"] as const,
    userSecrets: () => [...teamMcpKeys.all(), "userSecrets"] as const,
};
