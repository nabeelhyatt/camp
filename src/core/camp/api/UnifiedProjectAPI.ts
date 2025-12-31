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
    useAutoSyncProjectContextTextConvex,
    useGetProjectContextLLMMessageConvex,
    useGetProjectContextDataConvex,
    projectKeys,
    projectQueries,
} from "./ProjectAPIConvex";
import { useSetChatProjectConvex } from "./ChatAPIConvex";
import {
    useCreateProject as useCreateProjectSQLite,
    useRenameProject as useRenameProjectSQLite,
    useDeleteProject as useDeleteProjectSQLite,
    useToggleProjectIsCollapsed as useToggleProjectIsCollapsedSQLite,
    fetchProjects,
    fetchProject,
    // Re-export hooks that don't yet have Convex equivalents
    useAutoSyncProjectContextText as useAutoSyncProjectContextTextSQLite,
    useGetProjectContextLLMMessage as useGetProjectContextLLMMessageSQLite,
    useGetProjectContextData as useGetProjectContextDataSQLite,
    useSetMagicProjectsEnabled,
    useMarkProjectContextSummaryAsStale as useMarkProjectContextSummaryAsStaleSQLite,
    useRegenerateProjectContextSummaries as useRegenerateProjectContextSummariesSQLite,
    useDeleteAttachmentFromProject,
    useFinalizeAttachmentForProject,
    useSetChatProject as useSetChatProjectSQLite,
    projectContextQueries,
    fetchProjectContextText,
    fetchProjectContextAttachments,
    // Re-export types
    type Project,
    type Projects,
    type ProjectContextData,
} from "@core/chorus/api/ProjectAPI";
import { useQuery } from "@tanstack/react-query";

// Re-export hooks that don't yet have Convex equivalents (for backwards compatibility)
export {
    useSetMagicProjectsEnabled,
    useDeleteAttachmentFromProject,
    useFinalizeAttachmentForProject,
    projectContextQueries,
    fetchProjectContextText,
    fetchProjectContextAttachments,
    type Project,
    type Projects,
    type ProjectContextData,
};

/**
 * Mark project context summary as stale
 *
 * NOTE: This is not yet implemented for Convex. In Convex mode, this is a no-op
 * to avoid calling the SQLite layer with Convex chat IDs.
 */
export function useMarkProjectContextSummaryAsStale() {
    if (campConfig.useConvexData) {
        return {
            mutateAsync: async (_args: { chatId: string }) => {},
            mutate: (_args: { chatId: string }) => {},
            isLoading: false,
            isPending: false,
            isIdle: true,
        };
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMarkProjectContextSummaryAsStaleSQLite();
}

/**
 * Regenerate project context summaries
 *
 * NOTE: This is not yet implemented for Convex. In Convex mode, this is a no-op
 * to avoid calling the SQLite layer with Convex chat IDs.
 */
export function useRegenerateProjectContextSummaries() {
    if (campConfig.useConvexData) {
        return {
            mutateAsync: async (_args: { chatId: string }) => {},
            mutate: (_args: { chatId: string }) => {},
            isLoading: false,
            isPending: false,
            isIdle: true,
        };
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useRegenerateProjectContextSummariesSQLite();
}

/**
 * @deprecated Use useGetProjectContextData instead and merge context into the first user message.
 * Get project context for LLM conversations
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useGetProjectContextLLMMessage() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useGetProjectContextLLMMessageConvex();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useGetProjectContextLLMMessageSQLite();
}

/**
 * Get project context data for merging into user messages
 *
 * This returns the raw context text and attachments which should be merged
 * into the first user message of a conversation. This approach ensures the
 * model treats the context as background information, not a question to answer.
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useGetProjectContextData() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useGetProjectContextDataConvex();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useGetProjectContextDataSQLite();
}

// Re-export query keys for cache compatibility
export { projectKeys, projectQueries };

// ============================================================
// Query Hooks
// ============================================================

/**
 * List all projects in the current workspace
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 * This is safe because the conditional always evaluates the same way per build,
 * maintaining React's hook call order requirements.
 */
export function useProjectsQuery() {
    // campConfig.useConvexData is a build-time constant, so this branch is safe
    // Only call the hook for the active data layer to avoid side effects
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useProjectsQueryConvex();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery(projectQueries.list());
}

/**
 * Get a single project by ID
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 * This is safe because the conditional always evaluates the same way per build,
 * maintaining React's hook call order requirements.
 */
export function useProjectQuery(projectId: string | undefined) {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useProjectQueryConvex(projectId);
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
        ...projectQueries.detail(projectId),
        enabled: projectId !== undefined,
    });
}

/**
 * List projects with chat counts
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 * This is safe because the conditional always evaluates the same way per build,
 * maintaining React's hook call order requirements.
 */
export function useProjectsWithChatCountsQuery() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useProjectsWithChatCountsQueryConvex();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery(projectQueries.list());
}

// ============================================================
// Mutation Hooks
// ============================================================

/**
 * Create a new project
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useCreateProject() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useCreateProjectConvex();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCreateProjectSQLite();
}

/**
 * Rename a project
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useRenameProject() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useRenameProjectConvex();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useRenameProjectSQLite();
}

/**
 * Delete a project
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useDeleteProject() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useDeleteProjectConvex();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useDeleteProjectSQLite();
}

/**
 * Toggle project collapsed state
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useToggleProjectIsCollapsed() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useToggleProjectIsCollapsedConvex();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useToggleProjectIsCollapsedSQLite();
}

/**
 * Set a chat's project (move chat to a different project)
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 */
export function useSetChatProject() {
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useSetChatProjectConvex();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSetChatProjectSQLite();
}

/**
 * Auto-sync project context text (debounced save)
 * Returns { draft, setDraft } for local editing with auto-save
 *
 * NOTE: We branch on campConfig.useConvexData which is a build-time constant.
 * This is safe because the conditional always evaluates the same way per build,
 * maintaining React's hook call order requirements.
 */
export function useAutoSyncProjectContextText(projectId: string | undefined) {
    // campConfig.useConvexData is a build-time constant, so this branch is safe
    // Only call the hook for the active data layer to avoid side effects
    if (campConfig.useConvexData) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useAutoSyncProjectContextTextConvex(projectId);
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAutoSyncProjectContextTextSQLite(projectId ?? "");
}

// ============================================================
// Direct Fetch Functions (for non-hook contexts)
// ============================================================

// Note: Convex doesn't support direct fetch functions like SQLite.
// These are provided for backwards compatibility but only work with SQLite.
// If you need non-hook access with Convex, use the Convex client directly.

export { fetchProjects, fetchProject };
