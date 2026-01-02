/**
 * Team Toolsets API for Camp Multiplayer
 *
 * Provides React hooks that combine local toolsets with team MCPs.
 * This is the primary API for UI components that need to display
 * or manage toolsets in multiplayer mode.
 *
 * Key hooks:
 * - useAllToolsetConfigs() - Merged local + team configs with metadata
 * - useRefreshAllToolsets() - Refresh function that handles both sources
 */

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    useCustomToolsetConfigs,
    toolsetsKeys,
} from "@core/chorus/api/ToolsetsAPI";
import { ToolsetsManager } from "@core/chorus/ToolsetsManager";
import { useTeamMcps, useUserMcpSecrets, TeamMcpConfig } from "./TeamMcpAPI";
import {
    mergeToolsetConfigs,
    getRefreshableConfigs,
    TeamToolsetConfig,
    TeamMcpFromServer,
    UserMcpSecret,
} from "../TeamToolsetsWrapper";

// ============================================================
// Types
// ============================================================

export interface AllToolsetConfig extends TeamToolsetConfig {
    /** Is this toolset currently enabled? */
    enabled: boolean;
}

// ============================================================
// Query Keys
// ============================================================

export const teamToolsetsKeys = {
    all: () => ["teamToolsets"] as const,
    merged: () => [...teamToolsetsKeys.all(), "merged"] as const,
};

// ============================================================
// Hooks
// ============================================================

/**
 * Hook to get all toolset configs (local + team) with metadata
 *
 * This is the primary hook for UI components that display toolsets.
 * It handles:
 * - Merging local SQLite configs with Convex team MCPs
 * - Deduplication (local takes priority)
 * - Marking configs that need setup
 *
 * @returns Merged list of all toolset configs, or undefined while loading
 */
export function useAllToolsetConfigs(): AllToolsetConfig[] | undefined {
    // Fetch local custom toolsets from SQLite
    const { data: localConfigs, isLoading: localLoading } =
        useCustomToolsetConfigs();

    // Fetch team MCPs from Convex
    const teamMcps = useTeamMcps();

    // Fetch user's personal secrets for team MCPs
    const userSecrets = useUserMcpSecrets();

    // Wait for all data to be loaded
    const isLoading = localLoading || teamMcps === undefined;

    return useMemo(() => {
        if (isLoading || !localConfigs) {
            return undefined;
        }

        // Convert TeamMcpConfig to TeamMcpFromServer format
        const teamMcpsForMerge: TeamMcpFromServer[] = (teamMcps || []).map(
            (mcp: TeamMcpConfig) => ({
                _id: mcp._id,
                name: mcp.name,
                type: mcp.type,
                config: mcp.config,
                enabled: mcp.enabled,
                sharedBy: mcp.sharedBy,
                sharerSnapshot: mcp.sharerSnapshot,
                includeCredentials: mcp.includeCredentials,
                createdAt: mcp.createdAt,
                updatedAt: mcp.updatedAt,
                needsSetup: mcp.needsSetup,
                isSharer: mcp.isSharer,
                hasUserCredentials: mcp.hasUserCredentials,
            }),
        );

        // KNOWN LIMITATION (Phase 6): Sharer credentials not yet implemented
        // The sharerEnvs map is intentionally empty because:
        // 1. listForWorkspace doesn't return encrypted env data for security
        // 2. Real AES-GCM encryption for sharing credentials is Phase 6 work
        // 3. For now, MCPs shared with includeCredentials=true still require
        //    users to add their own credentials (they'll see "Setup required")
        // See: docs/archive/TEAM-MCPS-SPEC.md - Phase 6: Real Encryption
        const sharerEnvs = new Map<string, string>();

        // Merge local + team configs
        const merged = mergeToolsetConfigs(
            localConfigs,
            teamMcpsForMerge,
            (userSecrets || []) as UserMcpSecret[],
            sharerEnvs,
        );

        // Add enabled status (all configs are enabled by default for now)
        // TODO: Add per-config enable/disable toggle in UI
        return merged.map((config) => ({
            ...config,
            enabled: true,
        }));
    }, [isLoading, localConfigs, teamMcps, userSecrets]);
}

/**
 * Hook to get a refresh function for all toolsets
 *
 * This function refreshes the ToolsetsManager with merged configs.
 * Call this after:
 * - Sharing/unsharing an MCP
 * - Setting up credentials for a team MCP
 * - Enabling/disabling a toolset
 */
export function useRefreshAllToolsets() {
    const queryClient = useQueryClient();
    const allConfigs = useAllToolsetConfigs();

    return useCallback(
        async (
            toolsetsConfig: Record<string, Record<string, string>>,
        ): Promise<void> => {
            if (!allConfigs) {
                console.warn("Cannot refresh toolsets - configs not loaded");
                return;
            }

            // Get only configs that can be started (excludes needsSetup team MCPs)
            const refreshableConfigs = getRefreshableConfigs(allConfigs);

            // Refresh the ToolsetsManager
            await ToolsetsManager.instance.refreshToolsets(
                toolsetsConfig,
                refreshableConfigs,
            );

            // Invalidate toolsets query to update UI
            await queryClient.invalidateQueries({
                queryKey: toolsetsKeys.toolsets(),
            });
        },
        [allConfigs, queryClient],
    );
}

/**
 * Check if there are any team MCPs that need credential setup
 */
export function useHasTeamMcpsNeedingSetup(): boolean {
    const teamMcps = useTeamMcps();

    return useMemo(() => {
        if (!teamMcps) return false;
        return teamMcps.some((mcp) => mcp.needsSetup);
    }, [teamMcps]);
}

/**
 * Get count of team MCPs that need setup (for badge display)
 */
export function useTeamMcpsNeedingSetupCount(): number {
    const teamMcps = useTeamMcps();

    return useMemo(() => {
        if (!teamMcps) return 0;
        return teamMcps.filter((mcp) => mcp.needsSetup).length;
    }, [teamMcps]);
}

/**
 * Check if current workspace is a team workspace
 * (Team MCPs are only shown in team workspaces)
 */
export function useIsTeamWorkspace(): boolean {
    // TODO: Get this from workspace context
    // For now, return true to enable team MCPs
    return true;
}
