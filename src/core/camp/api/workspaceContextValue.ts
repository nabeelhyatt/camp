/**
 * Workspace Context Value Types and Creation
 *
 * Separated from React components to satisfy react-refresh rules.
 */

import { createContext } from "react";
import { Id } from "@convex/_generated/dataModel";

// Context value type
export interface WorkspaceContextValue {
    clerkId: string | null;
    workspaceId: Id<"workspaces"> | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

// Create context (not a component, so safe in .ts file)
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
    null,
);
