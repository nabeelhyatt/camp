/**
 * Unified Project API
 *
 * Switches between SQLite and Convex implementations based on the
 * campConfig.useConvexData feature flag.
 *
 * This file exports hooks with the SAME NAMES as the original SQLite hooks,
 * so consumers can simply change their import path.
 *
 * NOTE: Both SQLite and Convex hooks are always called (React hooks rule),
 * but only the selected implementation's data is returned.
 */

import { campConfig } from "@core/campConfig";
import {
    useProjectsQueryConvex,
    useProjectQueryConvex,
    useProjectsWithChatCountsQueryConvex,
    useCreateProjectConvex,
    useRenameProjectConvex,
    useDeleteProjectConvex,
    useToggleProjectIsCollapsedConvex,
    projectKeys,
    projectQueries,
} from "./ProjectAPIConvex";
import {
    useCreateProject as useCreateProjectSQLite,
    useRenameProject as useRenameProjectSQLite,
    useDeleteProject as useDeleteProjectSQLite,
    useToggleProjectIsCollapsed as useToggleProjectIsCollapsedSQLite,
    fetchProjects,
    fetchProject,
} from "@core/chorus/api/ProjectAPI";
import { useQuery } from "@tanstack/react-query";

// Re-export query keys for cache compatibility
export { projectKeys, projectQueries };

// ============================================================
// Query Hooks
// ============================================================

/**
 * List all projects in the current workspace
 */
export function useProjectsQuery() {
    // Always call both hooks (React hooks rule)
    const sqliteResult = useQuery({
        ...projectQueries.list(),
        enabled: !campConfig.useConvexData,
    });

    const convexResult = useProjectsQueryConvex();

    // Return based on feature flag (checked at render time, constant during session)
    return campConfig.useConvexData ? convexResult : sqliteResult;
}

/**
 * Get a single project by ID
 */
export function useProjectQuery(projectId: string | undefined) {
    // Always call both hooks (React hooks rule)
    const sqliteResult = useQuery({
        ...projectQueries.detail(projectId),
        enabled: !campConfig.useConvexData && projectId !== undefined,
    });

    const convexResult = useProjectQueryConvex(projectId);

    return campConfig.useConvexData ? convexResult : sqliteResult;
}

/**
 * List projects with chat counts
 */
export function useProjectsWithChatCountsQuery() {
    // Always call both hooks (React hooks rule)
    const sqliteResult = useQuery({
        ...projectQueries.list(),
        enabled: !campConfig.useConvexData,
    });

    const convexResult = useProjectsWithChatCountsQueryConvex();

    return campConfig.useConvexData ? convexResult : sqliteResult;
}

// ============================================================
// Mutation Hooks
// ============================================================

/**
 * Create a new project
 */
export function useCreateProject() {
    // Always call both hooks (React hooks rule)
    const convexMutation = useCreateProjectConvex();
    const sqliteMutation = useCreateProjectSQLite();

    return campConfig.useConvexData ? convexMutation : sqliteMutation;
}

/**
 * Rename a project
 */
export function useRenameProject() {
    // Always call both hooks (React hooks rule)
    const convexMutation = useRenameProjectConvex();
    const sqliteMutation = useRenameProjectSQLite();

    return campConfig.useConvexData ? convexMutation : sqliteMutation;
}

/**
 * Delete a project
 */
export function useDeleteProject() {
    // Always call both hooks (React hooks rule)
    const convexMutation = useDeleteProjectConvex();
    const sqliteMutation = useDeleteProjectSQLite();

    return campConfig.useConvexData ? convexMutation : sqliteMutation;
}

/**
 * Toggle project collapsed state
 */
export function useToggleProjectIsCollapsed() {
    // Always call both hooks (React hooks rule)
    const convexMutation = useToggleProjectIsCollapsedConvex();
    const sqliteMutation = useToggleProjectIsCollapsedSQLite();

    return campConfig.useConvexData ? convexMutation : sqliteMutation;
}

// ============================================================
// Direct Fetch Functions (for non-hook contexts)
// ============================================================

// Note: Convex doesn't support direct fetch functions like SQLite.
// These are provided for backwards compatibility but only work with SQLite.
// If you need non-hook access with Convex, use the Convex client directly.

export { fetchProjects, fetchProject };
