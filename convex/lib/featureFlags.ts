import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Feature flag helpers for Camp multiplayer
 *
 * Config-based feature flags stored in Convex (no redeploy needed).
 * Supports:
 * - Global flags (all workspaces)
 * - Per-workspace flags (override global)
 * - Gradual rollout (percentage-based)
 */

/**
 * Check if a feature is enabled
 *
 * Resolution order:
 * 1. Workspace-specific flag (if exists and user provided)
 * 2. Global flag
 * 3. Default to false
 *
 * For gradual rollouts, uses userId hash to determine bucket.
 */
export async function isFeatureEnabled(
    ctx: QueryCtx | MutationCtx,
    key: string,
    options?: {
        workspaceId?: Id<"workspaces">;
        userId?: Id<"users">;
    },
): Promise<boolean> {
    // First, check for workspace-specific flag
    if (options?.workspaceId) {
        const workspaceFlag = await ctx.db
            .query("featureFlags")
            .withIndex("by_key", (q) => q.eq("key", key))
            .filter((q) => q.eq(q.field("workspaceId"), options.workspaceId))
            .first();

        if (workspaceFlag) {
            return evaluateFlag(workspaceFlag, options.userId);
        }
    }

    // Fall back to global flag
    const globalFlag = await ctx.db
        .query("featureFlags")
        .withIndex("by_key", (q) => q.eq("key", key))
        .filter((q) => q.eq(q.field("workspaceId"), undefined))
        .first();

    if (globalFlag) {
        return evaluateFlag(globalFlag, options?.userId);
    }

    // Default: feature is disabled
    return false;
}

/**
 * Evaluate a flag, considering rollout percentage
 */
function evaluateFlag(
    flag: { enabled: boolean; rolloutPercentage?: number },
    userId?: Id<"users">,
): boolean {
    if (!flag.enabled) {
        return false;
    }

    // If no rollout percentage, feature is fully enabled
    if (flag.rolloutPercentage === undefined || flag.rolloutPercentage >= 100) {
        return true;
    }

    // If rollout percentage is 0, feature is disabled
    if (flag.rolloutPercentage <= 0) {
        return false;
    }

    // For gradual rollout, need a userId to determine bucket
    if (!userId) {
        // Without userId, cannot determine bucket - deny access to partial rollouts
        return false;
    }

    // Hash userId to get a consistent bucket (0-99)
    const bucket = hashToPercentage(userId);
    return bucket < flag.rolloutPercentage;
}

/**
 * Hash a string to a percentage (0-99)
 * Uses simple hash for deterministic bucketing
 */
function hashToPercentage(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % 100;
}

/**
 * Get all feature flags (for admin UI)
 */
export async function getAllFeatureFlags(
    ctx: QueryCtx | MutationCtx,
    workspaceId?: Id<"workspaces">,
) {
    const flags = await ctx.db.query("featureFlags").collect();

    // Filter by workspace if provided
    if (workspaceId) {
        return flags.filter(
            (f) => f.workspaceId === undefined || f.workspaceId === workspaceId,
        );
    }

    return flags;
}

// ============================================================
// Known Feature Flag Keys
// ============================================================

/**
 * Feature flag keys used in Camp
 * Define here for type safety and documentation
 */
export const FEATURE_FLAGS = {
    // Phase 1: Core multiplayer
    MULTIPLAYER_ENABLED: "multiplayer.enabled",

    // Phase 2: Private forks
    PRIVATE_FORKS_ENABLED: "private-forks.enabled",
    PUBLISH_SUMMARY_ENABLED: "publish-summary.enabled",

    // Phase 3: Team MCPs
    TEAM_MCPS_ENABLED: "team-mcps.enabled",
    TEAM_ADMIN_PAGE_ENABLED: "team-admin.enabled",

    // Phase 4: Visibility tiers
    SHARED_VISIBILITY_ENABLED: "shared-visibility.enabled",
    PRIVATE_VISIBILITY_ENABLED: "private-visibility.enabled",

    // Phase 5: Presence
    PRESENCE_ENABLED: "presence.enabled",
    TYPING_INDICATORS_ENABLED: "typing-indicators.enabled",

    // Phase 6: Sharing
    INVITE_SHARING_ENABLED: "invite-sharing.enabled",
    LINK_SHARING_ENABLED: "link-sharing.enabled",
} as const;
