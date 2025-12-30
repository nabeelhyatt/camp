/**
 * Convex Workspace Hooks
 *
 * Provides workspace-aware Convex hooks that automatically inject
 * clerkId and workspaceId into all queries and mutations.
 *
 * This file contains only hooks (no components) to satisfy react-refresh rules.
 */

import { useContext, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { Id } from "@convex/_generated/dataModel";
import {
    FunctionReference,
    FunctionArgs,
    FunctionReturnType,
} from "convex/server";
import {
    WorkspaceContext,
    WorkspaceContextValue,
} from "./workspaceContextValue";

/**
 * Hook to access workspace context directly
 */
export function useWorkspaceContext(): WorkspaceContextValue {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error(
            "useWorkspaceContext must be used within ConvexWorkspaceProvider",
        );
    }
    return context;
}

/**
 * Hook for workspace-scoped Convex queries
 *
 * Automatically injects clerkId and workspaceId into the query arguments.
 * Returns undefined while loading auth/workspace state.
 *
 * @example
 * const projects = useWorkspaceQuery(api.projects.list, {});
 */
export function useWorkspaceQuery<
    Query extends FunctionReference<"query", "public">,
>(
    query: Query,
    args: Omit<FunctionArgs<Query>, "clerkId" | "workspaceId">,
): FunctionReturnType<Query> | undefined {
    const { clerkId, workspaceId } = useWorkspaceContext();

    // Build full args with clerkId and workspaceId
    const fullArgs = useMemo(
        () => {
            if (!clerkId || !workspaceId) return "skip" as const;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return {
                ...args,
                clerkId,
                workspaceId,
            } as FunctionArgs<Query>;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(args), clerkId, workspaceId],
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return useQuery(query, fullArgs);
}

/**
 * Hook for Convex queries that only need clerkId (not workspace-scoped)
 *
 * @example
 * const user = useAuthQuery(api.auth.getCurrentUser, {});
 */
export function useAuthQuery<
    Query extends FunctionReference<"query", "public">,
>(
    query: Query,
    args: Omit<FunctionArgs<Query>, "clerkId">,
): FunctionReturnType<Query> | undefined {
    const { clerkId } = useWorkspaceContext();

    const fullArgs = useMemo(
        () => {
            if (!clerkId) return "skip" as const;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return {
                ...args,
                clerkId,
            } as FunctionArgs<Query>;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(args), clerkId],
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return useQuery(query, fullArgs);
}

/**
 * Hook for workspace-scoped Convex mutations
 *
 * Returns a mutation function that automatically injects clerkId and workspaceId.
 *
 * @example
 * const createProject = useWorkspaceMutation(api.projects.create);
 * await createProject({ name: "My Project" });
 */
export function useWorkspaceMutation<
    Mutation extends FunctionReference<"mutation", "public">,
>(
    mutation: Mutation,
): (
    args: Omit<FunctionArgs<Mutation>, "clerkId" | "workspaceId">,
) => Promise<FunctionReturnType<Mutation>> {
    const { clerkId, workspaceId } = useWorkspaceContext();
    const mutate = useMutation(mutation);

    return async (
        args: Omit<FunctionArgs<Mutation>, "clerkId" | "workspaceId">,
    ) => {
        if (!clerkId || !workspaceId) {
            throw new Error("Not authenticated or no active workspace");
        }

        const fullArgs = {
            ...args,
            clerkId,
            workspaceId,
        } as FunctionArgs<Mutation>;

        return mutate(fullArgs);
    };
}

/**
 * Hook for mutations that only need clerkId (not workspace-scoped)
 *
 * @example
 * const setWorkspace = useAuthMutation(api.auth.setActiveWorkspace);
 * await setWorkspace({ workspaceId: "..." });
 */
export function useAuthMutation<
    Mutation extends FunctionReference<"mutation", "public">,
>(
    mutation: Mutation,
): (
    args: Omit<FunctionArgs<Mutation>, "clerkId">,
) => Promise<FunctionReturnType<Mutation>> {
    const { clerkId } = useWorkspaceContext();
    const mutate = useMutation(mutation);

    return async (args: Omit<FunctionArgs<Mutation>, "clerkId">) => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }

        const fullArgs = {
            ...args,
            clerkId,
        } as FunctionArgs<Mutation>;

        return mutate(fullArgs);
    };
}

/**
 * Hook to check if the workspace context is ready for queries
 *
 * Use this to conditionally render loading states or skip queries
 *
 * @example
 * const { isReady } = useWorkspaceReady();
 * if (!isReady) return <Loading />;
 */
export function useWorkspaceReady(): {
    isReady: boolean;
    isLoading: boolean;
    clerkId: string | null;
    workspaceId: Id<"workspaces"> | null;
} {
    const { clerkId, workspaceId, isLoading } = useWorkspaceContext();

    return {
        isReady: !isLoading && !!clerkId && !!workspaceId,
        isLoading,
        clerkId,
        workspaceId,
    };
}
