/**
 * Convex Project API
 *
 * Provides TanStack React Query-compatible hooks for project operations
 * using the Convex backend. These hooks maintain the same interface as
 * the SQLite-based ProjectAPI for seamless switching.
 */

import { useQuery, useMutation } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@convex/_generated/api";
import { useWorkspaceContext } from "./useWorkspaceHooks";
import {
    convexProjectToProject,
    convexProjectsToProjects,
    stringToConvexIdStrict,
} from "./convexTypes";
import { projectKeys, projectQueries } from "@core/chorus/api/ProjectAPI";
import { campConfig } from "@core/campConfig";

// ============================================================
// Query Keys (for cache management)
// ============================================================

// Use the same query keys as SQLite version for cache compatibility
export { projectKeys, projectQueries };

// ============================================================
// Queries
// ============================================================

/**
 * Hook to list all projects in the current workspace
 *
 * Returns the same shape as useQuery(projectQueries.list()) for compatibility
 */
export function useProjectsQueryConvex() {
    const {
        clerkId,
        workspaceId,
        isLoading: contextLoading,
    } = useWorkspaceContext();

    // Skip Convex queries when not using Convex data layer
    const shouldSkip = !campConfig.useConvexData;

    const result = useQuery(
        api.projects.list,
        !shouldSkip && clerkId && workspaceId
            ? { clerkId, workspaceId }
            : "skip",
    );

    // Transform to frontend types
    const data = result ? convexProjectsToProjects(result) : undefined;

    // Return object compatible with TanStack Query return type
    return {
        data,
        isLoading: contextLoading || result === undefined,
        isError: false,
        error: null,
        // Convex queries auto-update, so these are always "fresh"
        isStale: false,
        isFetching: result === undefined,
    };
}

/**
 * Hook to get a single project by ID
 */
export function useProjectQueryConvex(projectId: string | undefined) {
    const { clerkId } = useWorkspaceContext();

    // Skip Convex queries when not using Convex data layer
    const shouldSkip = !campConfig.useConvexData;

    const result = useQuery(
        api.projects.get,
        !shouldSkip && clerkId && projectId
            ? {
                  clerkId,
                  projectId: stringToConvexIdStrict<"projects">(projectId),
              }
            : "skip",
    );

    const data = result ? convexProjectToProject(result) : undefined;

    return {
        data,
        isLoading: result === undefined && !!projectId,
        isError: false,
        error: null,
    };
}

/**
 * Hook to list projects with chat counts
 */
export function useProjectsWithChatCountsQueryConvex() {
    const {
        clerkId,
        workspaceId,
        isLoading: contextLoading,
    } = useWorkspaceContext();

    // Skip Convex queries when not using Convex data layer
    const shouldSkip = !campConfig.useConvexData;

    const result = useQuery(
        api.projects.listWithChatCounts,
        !shouldSkip && clerkId && workspaceId
            ? { clerkId, workspaceId }
            : "skip",
    );

    // Transform to frontend types with chatCount added
    const data = result
        ? result.map((p) => ({
              ...convexProjectToProject(p),
              chatCount: p.chatCount,
          }))
        : undefined;

    return {
        data,
        isLoading: contextLoading || result === undefined,
        isError: false,
        error: null,
    };
}

// ============================================================
// Mutations
// ============================================================

/**
 * Hook to create a new project
 *
 * Matches the SQLite version behavior:
 * - Creates with empty name (user renames inline)
 * - Navigates to the new project
 */
export function useCreateProjectConvex() {
    const { clerkId, workspaceId } = useWorkspaceContext();
    const createProject = useMutation(api.projects.create);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    return {
        mutateAsync: async () => {
            if (!clerkId || !workspaceId) {
                throw new Error("Not authenticated or no active workspace");
            }

            const projectId = await createProject({
                clerkId,
                workspaceId,
                name: "", // Empty name, user renames inline
            });

            // Invalidate the project list cache
            void queryClient.invalidateQueries({ queryKey: projectKeys.all() });

            // Navigate to the new project (matches SQLite behavior)
            navigate(`/projects/${projectId}`);

            return projectId as unknown as string;
        },
        isLoading: false,
    };
}

/**
 * Hook to rename a project
 */
export function useRenameProjectConvex() {
    const { clerkId } = useWorkspaceContext();
    const updateProject = useMutation(api.projects.update);
    const queryClient = useQueryClient();

    return {
        mutateAsync: async (args: { projectId: string; newName: string }) => {
            if (!clerkId) {
                throw new Error("Not authenticated");
            }

            await updateProject({
                clerkId,
                projectId: stringToConvexIdStrict<"projects">(args.projectId),
                name: args.newName,
            });

            // Invalidate caches
            void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
        },
        isLoading: false,
    };
}

/**
 * Hook to update a project's description
 */
export function useUpdateProjectDescriptionConvex() {
    const { clerkId } = useWorkspaceContext();
    const updateProject = useMutation(api.projects.update);
    const queryClient = useQueryClient();

    return {
        mutateAsync: async (args: {
            projectId: string;
            description: string;
        }) => {
            if (!clerkId) {
                throw new Error("Not authenticated");
            }

            await updateProject({
                clerkId,
                projectId: stringToConvexIdStrict<"projects">(args.projectId),
                description: args.description,
            });

            void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
        },
        isLoading: false,
    };
}

/**
 * Hook to delete a project
 */
export function useDeleteProjectConvex() {
    const { clerkId } = useWorkspaceContext();
    const removeProject = useMutation(api.projects.remove);
    const queryClient = useQueryClient();

    return {
        mutateAsync: async (args: { projectId: string }) => {
            if (!clerkId) {
                throw new Error("Not authenticated");
            }

            await removeProject({
                clerkId,
                projectId: stringToConvexIdStrict<"projects">(args.projectId),
            });

            // Invalidate caches
            void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
        },
        isLoading: false,
    };
}

// ============================================================
// Local Storage Helpers (for UI state not in Convex)
// ============================================================

const COLLAPSED_PROJECTS_KEY = "camp:collapsedProjects";

/**
 * Get the set of collapsed project IDs from localStorage
 */
function getCollapsedProjects(): Set<string> {
    try {
        const stored = localStorage.getItem(COLLAPSED_PROJECTS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as string[];
            return new Set(parsed);
        }
    } catch {
        // Ignore parse errors
    }
    return new Set();
}

/**
 * Save the set of collapsed project IDs to localStorage
 */
function setCollapsedProjects(collapsed: Set<string>): void {
    localStorage.setItem(
        COLLAPSED_PROJECTS_KEY,
        JSON.stringify([...collapsed]),
    );
}

/**
 * Hook to toggle project collapsed state (stored in localStorage)
 *
 * Note: isCollapsed is a UI state, not stored in Convex.
 * We use localStorage for persistence across sessions.
 */
export function useToggleProjectIsCollapsedConvex() {
    const queryClient = useQueryClient();

    return {
        mutateAsync: ({ projectId }: { projectId: string }) => {
            const collapsed = getCollapsedProjects();

            if (collapsed.has(projectId)) {
                collapsed.delete(projectId);
            } else {
                collapsed.add(projectId);
            }

            setCollapsedProjects(collapsed);

            // Invalidate to trigger re-render with new collapse state
            void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
        },
        isLoading: false,
    };
}

/**
 * Check if a project is collapsed (from localStorage)
 */
export function isProjectCollapsed(projectId: string): boolean {
    return getCollapsedProjects().has(projectId);
}

// ============================================================
// Fetch Functions (for direct calls, not hooks)
// ============================================================

// Note: Convex doesn't support direct fetch functions like SQLite.
// These are only available as hooks. If non-hook access is needed,
// consider using the Convex client directly or refactoring the caller.
