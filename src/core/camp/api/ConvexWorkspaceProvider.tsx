/**
 * Convex Workspace Provider Component
 *
 * This file contains only the React component to satisfy react-refresh rules.
 * Context and hooks are in separate files.
 */

import { useMemo, ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useCurrentUser } from "@core/camp/auth/useCurrentUser";
import { WorkspaceContext } from "./workspaceContextValue";

/**
 * Provider component that wraps the app and provides workspace context
 */
export function ConvexWorkspaceProvider({ children }: { children: ReactNode }) {
    const { userId: clerkId } = useAuth();
    const { isLoading, isAuthenticated, activeWorkspace, user } =
        useCurrentUser();

    const value = useMemo(
        () => ({
            clerkId: clerkId ?? null,
            userId: user?._id ?? null,
            workspaceId: activeWorkspace?._id ?? null,
            isLoading,
            isAuthenticated,
        }),
        [clerkId, user?._id, activeWorkspace?._id, isLoading, isAuthenticated],
    );

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
        </WorkspaceContext.Provider>
    );
}
