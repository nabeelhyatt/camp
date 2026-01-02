/**
 * Team Toolsets Wrapper for Camp Multiplayer
 *
 * This wrapper extends the local ToolsetsManager with team MCP support.
 * It merges team MCPs from Convex with local custom toolsets, handling:
 * - Credential resolution (user secrets → sharer credentials)
 * - Decryption of encrypted env variables
 * - Deduplication (local takes priority over team)
 *
 * Key principle: MCPs run locally on each user's machine.
 * Team MCPs are just shared configurations that users can enable.
 */

import { CustomToolsetConfig } from "@core/chorus/Toolsets";
import { decryptApiKey } from "@core/camp/api/ApiKeyUtils";
import { Id } from "@convex/_generated/dataModel";

// ============================================================
// Types
// ============================================================

/**
 * Team MCP as returned from Convex (listForWorkspace)
 */
export interface TeamMcpFromServer {
    _id: Id<"mcpConfigs">;
    name: string;
    type: "api" | "local";
    config: {
        command: string;
        args: string;
        /** Encrypted env (base64) - already resolved from user secrets or sharer credentials */
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
    needsSetup: boolean;
    isSharer: boolean;
    hasUserCredentials: boolean;
}

/**
 * Extended CustomToolsetConfig with team MCP metadata
 */
export interface TeamToolsetConfig extends CustomToolsetConfig {
    /** Source of this config: "local" (SQLite) or "team" (Convex) */
    source: "local" | "team";
    /** Team MCP ID (only for source="team") */
    teamMcpId?: Id<"mcpConfigs">;
    /** Whether this team MCP needs user credential setup */
    needsSetup?: boolean;
    /** Sharer info for team MCPs */
    sharer?: {
        displayName: string;
        avatarUrl?: string;
    };
}

// ============================================================
// Merge Logic
// ============================================================

/**
 * Merge local custom toolsets with team MCPs
 *
 * Resolution order:
 * 1. Local configs take priority (user's own MCPs)
 * 2. Team MCPs are added if not duplicated by name
 *
 * Credential resolution is done server-side in listForWorkspace:
 * - User's own credentials (mcpUserSecrets) take priority
 * - Falls back to sharer's credentials (if includeCredentials=true)
 *
 * @param localConfigs - Custom toolsets from local SQLite database
 * @param teamMcps - Team MCPs from Convex (from useTeamMcps hook)
 * @returns Merged list of toolset configs ready for ToolsetsManager
 */
export function mergeToolsetConfigs(
    localConfigs: CustomToolsetConfig[],
    teamMcps: TeamMcpFromServer[],
): TeamToolsetConfig[] {
    // Start with local configs (they take priority)
    const result: TeamToolsetConfig[] = localConfigs.map((config) => ({
        ...config,
        source: "local" as const,
    }));

    // Track local config names for deduplication
    const localNames = new Set(localConfigs.map((c) => c.name));

    // Add team MCPs that don't conflict with local configs
    for (const teamMcp of teamMcps) {
        // Skip disabled team MCPs
        if (!teamMcp.enabled) {
            continue;
        }

        // Skip if local config with same name exists
        if (localNames.has(teamMcp.name)) {
            console.log(
                `Team MCP "${teamMcp.name}" skipped - local config takes priority`,
            );
            continue;
        }

        // Skip if MCP needs setup (no credentials available)
        if (teamMcp.needsSetup) {
            console.log(
                `Team MCP "${teamMcp.name}" needs setup - not starting`,
            );
            // Still add to list so UI can show "Setup required" badge
            result.push({
                name: teamMcp.name,
                command: teamMcp.config.command,
                args: teamMcp.config.args,
                env: "{}", // Empty env since no credentials
                source: "team",
                teamMcpId: teamMcp._id,
                needsSetup: true,
                sharer: teamMcp.sharerSnapshot
                    ? {
                          displayName: teamMcp.sharerSnapshot.displayName,
                          avatarUrl: teamMcp.sharerSnapshot.avatarUrl,
                      }
                    : undefined,
            });
            continue;
        }

        // Decrypt credentials from the resolved encryptedEnv
        // (server already resolved: user secrets > sharer credentials)
        let env = "{}";
        if (teamMcp.config.encryptedEnv) {
            try {
                const decrypted = decryptApiKey(teamMcp.config.encryptedEnv);
                env = decrypted;
            } catch (error) {
                console.error(
                    `Failed to decrypt credentials for ${teamMcp.name}:`,
                    error,
                );
            }
        }

        result.push({
            name: teamMcp.name,
            command: teamMcp.config.command,
            args: teamMcp.config.args,
            env,
            source: "team",
            teamMcpId: teamMcp._id,
            needsSetup: false,
            sharer: teamMcp.sharerSnapshot
                ? {
                      displayName: teamMcp.sharerSnapshot.displayName,
                      avatarUrl: teamMcp.sharerSnapshot.avatarUrl,
                  }
                : undefined,
        });
    }

    return result;
}

/**
 * Filter merged configs to only those suitable for ToolsetsManager
 * (Removes team MCPs that need setup, as they can't run)
 */
export function getRefreshableConfigs(
    mergedConfigs: TeamToolsetConfig[],
): CustomToolsetConfig[] {
    return mergedConfigs
        .filter((config) => config.source === "local" || !config.needsSetup)
        .map(({ source, teamMcpId, needsSetup, sharer, ...config }) => config);
}

// ============================================================
// Utilities
// ============================================================

/**
 * Check if a config is a team MCP
 */
export function isTeamConfig(
    config: CustomToolsetConfig | TeamToolsetConfig,
): config is TeamToolsetConfig & { source: "team" } {
    return (config as TeamToolsetConfig).source === "team";
}

/**
 * Get display info for a toolset config
 * Returns sharer info for team MCPs, null for local
 */
export function getConfigSharer(
    config: CustomToolsetConfig | TeamToolsetConfig,
): { displayName: string; avatarUrl?: string } | undefined {
    if (isTeamConfig(config)) {
        return config.sharer;
    }
    return undefined;
}
