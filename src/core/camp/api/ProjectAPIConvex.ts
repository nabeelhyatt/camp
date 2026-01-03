/**
 * Convex Project API
 *
 * Provides TanStack React Query-compatible hooks for project operations
 * using the Convex backend. These hooks maintain the same interface as
 * the SQLite-based ProjectAPI for seamless switching.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@convex/_generated/api";
import { useWorkspaceContext } from "./useWorkspaceHooks";
import {
    convexProjectToProject,
    convexProjectsToProjects,
    convexProjectsWithCreatorsToProjectsWithCreators,
    stringToConvexIdStrict,
    isSentinelProjectId,
} from "./convexTypes";
import { projectKeys, projectQueries } from "@core/chorus/api/ProjectAPI";
import { campConfig } from "@core/campConfig";

// ============================================================
// Constants
// ============================================================

// Event name for project collapse state changes (used to force re-render)
const COLLAPSE_CHANGE_EVENT = "camp:projectCollapseChange";

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

    // Track collapse state changes to force re-render
    // This is needed because collapse state is in localStorage, not Convex
    const [collapseVersion, setCollapseVersion] = useState(0);
    useEffect(() => {
        const handleCollapseChange = () => {
            setCollapseVersion((v) => v + 1);
        };
        window.addEventListener(COLLAPSE_CHANGE_EVENT, handleCollapseChange);
        return () => {
            window.removeEventListener(
                COLLAPSE_CHANGE_EVENT,
                handleCollapseChange,
            );
        };
    }, []);

    // Transform to frontend types - re-compute when collapse state changes
    const data = useMemo(
        () => (result ? convexProjectsToProjects(result) : undefined),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [result, collapseVersion],
    );

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

    // Skip if projectId is a sentinel (like "default" or "quick-chat")
    // These are virtual project IDs that don't exist in Convex
    const isSentinel = projectId && isSentinelProjectId(projectId);

    const result = useQuery(
        api.projects.get,
        !shouldSkip && clerkId && projectId && !isSentinel
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

/**
 * Hook to list projects with creator information for attribution
 * Used in list views like Team Projects page
 */
export function useProjectsWithCreatorsQueryConvex() {
    const {
        clerkId,
        workspaceId,
        isLoading: contextLoading,
    } = useWorkspaceContext();

    // Skip Convex queries when not using Convex data layer
    const shouldSkip = !campConfig.useConvexData;

    const result = useQuery(
        api.projects.listWithCreators,
        !shouldSkip && clerkId && workspaceId
            ? { clerkId, workspaceId }
            : "skip",
    );

    // Transform to frontend types with creator added
    const data = result
        ? convexProjectsWithCreatorsToProjectsWithCreators(result)
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

    const mutateAsync = async () => {
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

        return String(projectId);
    };

    return {
        mutateAsync,
        mutate: () => void mutateAsync(),
        isLoading: false,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Hook to rename a project
 */
export function useRenameProjectConvex() {
    const { clerkId } = useWorkspaceContext();
    const updateProject = useMutation(api.projects.update);
    const queryClient = useQueryClient();

    const mutateAsync = async (args: {
        projectId: string;
        newName: string;
    }) => {
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
    };

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isLoading: false,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Hook to update a project's description
 */
export function useUpdateProjectDescriptionConvex() {
    const { clerkId } = useWorkspaceContext();
    const updateProject = useMutation(api.projects.update);
    const queryClient = useQueryClient();

    const mutateAsync = async (args: {
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
    };

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isLoading: false,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Hook to delete a project
 */
export function useDeleteProjectConvex() {
    const { clerkId } = useWorkspaceContext();
    const removeProject = useMutation(api.projects.remove);
    const queryClient = useQueryClient();

    const mutateAsync = async (args: { projectId: string }) => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }

        await removeProject({
            clerkId,
            projectId: stringToConvexIdStrict<"projects">(args.projectId),
        });

        // Invalidate caches
        void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
    };

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isLoading: false,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Auto-sync project context text to Convex
 * Mirrors the SQLite useAutoSyncProjectContextText behavior from use-react-query-auto-sync
 * Note: Currently saves immediately on change. Future: add debouncing if needed.
 *
 * Returns { draft, setDraft } where:
 * - draft: the current text value (initialized from server, updated locally)
 * - setDraft: function to update the local draft (triggers save)
 */
export function useAutoSyncProjectContextTextConvex(
    projectId: string | undefined,
) {
    const { clerkId } = useWorkspaceContext();
    const projectResult = useProjectQueryConvex(projectId);
    const updateProject = useMutation(api.projects.update);

    const [localDraft, setLocalDraft] = useState<string>("");
    const [isInitialized, setIsInitialized] = useState(false);
    const [lastSaved, setLastSaved] = useState<string>("");

    // Track if user has started editing to prevent server data from overwriting
    const hasUserEditedRef = useRef(false);

    // Initialize from server data when it arrives
    // BUT only if user hasn't started editing (prevents race condition)
    useEffect(() => {
        if (projectResult.data && !isInitialized && !hasUserEditedRef.current) {
            setLocalDraft(projectResult.data.contextText ?? "");
            setLastSaved(projectResult.data.contextText ?? "");
            setIsInitialized(true);
        }
    }, [projectResult.data, isInitialized]);

    // Reset when project changes
    useEffect(() => {
        setIsInitialized(false);
        setLocalDraft("");
        setLastSaved("");
        hasUserEditedRef.current = false;
    }, [projectId]);

    // Save to Convex whenever the local draft changes
    useEffect(() => {
        if (!isInitialized || !projectId || !clerkId) return;
        if (localDraft === lastSaved) return;
        // Don't try to save sentinel project IDs - they don't exist in Convex
        if (isSentinelProjectId(projectId)) return;

        void updateProject({
            clerkId,
            projectId: stringToConvexIdStrict<"projects">(projectId),
            contextText: localDraft,
        });
        setLastSaved(localDraft);
    }, [
        localDraft,
        projectId,
        clerkId,
        isInitialized,
        updateProject,
        lastSaved,
    ]);

    // Wrapper that sets the edit flag before updating local draft
    const setDraftWithEditFlag = useCallback(
        (value: string | ((prev: string) => string)) => {
            hasUserEditedRef.current = true;
            setLocalDraft(value);
        },
        [],
    );

    return {
        draft: localDraft,
        setDraft: setDraftWithEditFlag,
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
 * and dispatch a custom event to notify listeners
 */
function setCollapsedProjects(collapsed: Set<string>): void {
    localStorage.setItem(
        COLLAPSED_PROJECTS_KEY,
        JSON.stringify([...collapsed]),
    );
    // Dispatch event to notify listeners (like useProjectsQueryConvex)
    window.dispatchEvent(new CustomEvent(COLLAPSE_CHANGE_EVENT));
}

/**
 * Hook to toggle project collapsed state (stored in localStorage)
 *
 * Note: isCollapsed is a UI state, not stored in Convex.
 * We use localStorage for persistence across sessions.
 */
export function useToggleProjectIsCollapsedConvex() {
    const queryClient = useQueryClient();

    const mutateAsync = ({ projectId }: { projectId: string }) => {
        const collapsed = getCollapsedProjects();

        if (collapsed.has(projectId)) {
            collapsed.delete(projectId);
        } else {
            collapsed.add(projectId);
        }

        setCollapsedProjects(collapsed);

        // Invalidate to trigger re-render with new collapse state
        void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
    };

    return {
        mutateAsync,
        mutate: (args: Parameters<typeof mutateAsync>[0]) =>
            void mutateAsync(args),
        isLoading: false,
        isPending: false,
        isIdle: true,
    };
}

/**
 * Check if a project is collapsed (from localStorage)
 */
export function isProjectCollapsed(projectId: string): boolean {
    return getCollapsedProjects().has(projectId);
}

// ============================================================
// Project Context for LLM
// ============================================================

import type { LLMMessage } from "@core/chorus/Models";
import * as Prompts from "@core/chorus/prompts/prompts";

/**
 * Convex version of useGetProjectContextLLMMessage
 *
 * Returns a function that builds LLM context messages from project data.
 * Uses the Convex client to fetch project data imperatively.
 * Uses the same PROJECTS_CONTEXT_PROMPT format as the SQLite version
 * to ensure consistent prompt structure following Anthropic's best practices.
 */
export function useGetProjectContextLLMMessageConvex(): (
    projectId: string,
    chatId: string,
) => Promise<LLMMessage[]> {
    const { clerkId } = useWorkspaceContext();
    const convex = useConvex();

    return useCallback(
        async (projectId: string, _chatId: string): Promise<LLMMessage[]> => {
            // Skip sentinel project IDs (like "default" or "quick-chat")
            if (isSentinelProjectId(projectId)) {
                return [];
            }

            if (!clerkId) {
                console.warn(
                    "[useGetProjectContextLLMMessageConvex] No clerkId, skipping project context",
                );
                return [];
            }

            try {
                // Fetch project data from Convex
                const project = await convex.query(api.projects.get, {
                    clerkId,
                    projectId: stringToConvexIdStrict<"projects">(projectId),
                });

                if (!project || !project.contextText) {
                    console.log(
                        `[useGetProjectContextLLMMessageConvex] No context text for project ${projectId}`,
                    );
                    return [];
                }

                // Build the LLM message with project context using the shared prompt format
                // This follows Anthropic's recommended document structure for long context
                const contextMessage: LLMMessage = {
                    role: "user",
                    content: Prompts.PROJECTS_CONTEXT_PROMPT(
                        project.contextText,
                        [], // TODO: Add chat summaries when magic projects is implemented for Convex
                    ),
                    attachments: [],
                };

                // Assistant acknowledges context - this creates a clear boundary
                // between context setup and actual conversation. Without this,
                // the model may focus on the context rather than the user's question.
                // This matches the SQLite version's behavior.
                const contextAck: LLMMessage = {
                    role: "assistant",
                    content: "Okay.",
                    toolCalls: [],
                };

                console.log(
                    `[useGetProjectContextLLMMessageConvex] Added project context (${project.contextText.length} chars)`,
                );

                return [contextMessage, contextAck];
            } catch (error) {
                console.error(
                    "[useGetProjectContextLLMMessageConvex] Error fetching project:",
                    error,
                );
                return [];
            }
        },
        [clerkId, convex],
    );
}

// ============================================================
// Project Title Generation
// ============================================================

/**
 * Hook to generate a title for a project.
 * Only generates if the project has no name (empty string).
 * Uses project context if available, otherwise falls back to first chat message.
 * Uses client-side simpleLLM for now (reuses existing infrastructure).
 */
export function useGenerateProjectTitleConvex() {
    const { clerkId } = useWorkspaceContext();
    const updateProject = useMutation(api.projects.update);
    const convex = useConvex();
    const queryClient = useQueryClient();

    const [isPending, setIsPending] = useState(false);

    const mutateAsync = useCallback(
        async (args: { projectId: string; chatId?: string }) => {
            if (!clerkId) {
                console.warn(
                    "[useGenerateProjectTitleConvex] No clerkId, skipping",
                );
                return { skipped: true };
            }

            setIsPending(true);

            try {
                // Check if project already has a name
                const projectId = stringToConvexIdStrict<"projects">(
                    args.projectId,
                );
                const project = await convex.query(api.projects.get, {
                    clerkId,
                    projectId,
                });

                if (project?.name && project.name.trim() !== "") {
                    console.log(
                        "[useGenerateProjectTitleConvex] Project already has name, skipping",
                    );
                    return { skipped: true };
                }

                // Gather content from all available sources
                let contentForTitle: string | undefined = project?.contextText;
                let contentSource = "context";

                // Also check SQLite project attachments (stored locally even in Convex mode)
                try {
                    const { fetchProjectContextAttachments } = await import(
                        "@core/chorus/api/ProjectAPI"
                    );
                    const attachments = await fetchProjectContextAttachments(
                        args.projectId,
                    );

                    if (attachments && attachments.length > 0) {
                        const attachmentNames = attachments
                            .map((a) => a.originalName)
                            .join(", ");
                        if (contentForTitle) {
                            contentForTitle += `\n\nAttached files: ${attachmentNames}`;
                        } else {
                            contentForTitle = `Attached files: ${attachmentNames}`;
                            contentSource = "attachments";
                        }
                    }
                } catch (attachError) {
                    // SQLite may not be available or have this project
                    console.debug(
                        "[useGenerateProjectTitleConvex] Could not fetch project attachments:",
                        attachError,
                    );
                }

                // If no project context and we have a chatId, try to get first user message
                if (!contentForTitle && args.chatId) {
                    const chatId = stringToConvexIdStrict<"chats">(args.chatId);
                    const messageSets = await convex.query(
                        api.messages.listSetsWithMessages,
                        { clerkId, chatId },
                    );

                    if (messageSets && messageSets.length > 0) {
                        for (const set of messageSets) {
                            for (const msg of set.messages) {
                                if (msg.role === "user") {
                                    const textParts = msg.parts
                                        .filter((p) => p.type === "text")
                                        .sort((a, b) => a.order - b.order)
                                        .map((p) => p.content)
                                        .join("");

                                    if (textParts) {
                                        contentForTitle = textParts;
                                        contentSource = "message";
                                        break;
                                    }
                                }
                            }
                            if (contentForTitle) break;
                        }
                    }
                }

                if (!contentForTitle) {
                    console.log(
                        "[useGenerateProjectTitleConvex] No content found for title generation, skipping",
                    );
                    return { skipped: true };
                }

                // Truncate content if too long (context can be very large)
                const truncatedContent =
                    contentForTitle.length > 2000
                        ? contentForTitle.slice(0, 2000) + "..."
                        : contentForTitle;

                console.log(
                    `[useGenerateProjectTitleConvex] Generating title from ${contentSource}`,
                );

                // Dynamic import simpleLLM to avoid loading when not needed
                const { simpleLLM } = await import("@core/chorus/simpleLLM");

                const fullResponse = await simpleLLM(
                    `Write a 1-3 word title for this project. Put the most important word FIRST.

Rules:
- Be extremely concise: 1-3 words max
- Lead with the main subject (company name, technology, specific topic)
- Avoid filler words like "Setup", "Analysis", "Project" unless essential
- No articles (a, an, the)
- Fix obvious typos

Examples of good titles:
- "Discord" (not "Discord Analysis of Board Decks")
- "Compound Engineering" (not "Setup for Compound Engineering")
- "React Performance" (not "Optimizing React App Performance")
- "Series B Deck" (not "Building Our Series B Pitch Deck")
- "User Auth Flow" (not "Implementing User Authentication")
- "Stripe Integration" (not "How to Integrate Stripe Payments")

If there's no clear topic, return "Untitled Project".

Format your response as <title>YOUR TITLE HERE</title>.

<content>
${truncatedContent}
</content>`,
                    {
                        model: "claude-3-5-sonnet-latest",
                        maxTokens: 100,
                    },
                );

                // Extract title from XML tags
                const match = fullResponse.match(/<title>(.*?)<\/title>/s);
                if (!match || !match[1]) {
                    console.warn(
                        "[useGenerateProjectTitleConvex] No title found in response:",
                        fullResponse,
                    );
                    return { skipped: true };
                }

                const cleanTitle = match[1]
                    .trim()
                    .slice(0, 40)
                    .replace(/["']/g, "");

                if (cleanTitle && cleanTitle !== "Untitled Project") {
                    console.log(
                        "[useGenerateProjectTitleConvex] Setting project title to:",
                        cleanTitle,
                    );

                    await updateProject({
                        clerkId,
                        projectId,
                        name: cleanTitle,
                    });

                    // Invalidate cache
                    void queryClient.invalidateQueries({
                        queryKey: projectKeys.all(),
                    });

                    return { title: cleanTitle };
                }

                return { skipped: true };
            } catch (error) {
                console.error("[useGenerateProjectTitleConvex] Error:", error);
                return { skipped: true };
            } finally {
                setIsPending(false);
            }
        },
        [clerkId, convex, updateProject, queryClient],
    );

    return {
        mutateAsync,
        mutate: (args: { projectId: string; chatId?: string }) =>
            void mutateAsync(args),
        isPending,
        isIdle: !isPending,
        isLoading: isPending,
    };
}

// ============================================================
// Fetch Functions (for direct calls, not hooks)
// ============================================================

// Note: Convex doesn't support direct fetch functions like SQLite.
// These are only available as hooks. If non-hook access is needed,
// consider using the Convex client directly or refactoring the caller.
