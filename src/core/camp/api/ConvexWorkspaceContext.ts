/**
 * Convex Workspace Context - Re-exports
 *
 * This file re-exports everything needed for workspace-aware Convex access.
 * The implementation is split across multiple files to satisfy react-refresh rules.
 */

// Provider component
export { ConvexWorkspaceProvider } from "./ConvexWorkspaceProvider";

// Context value type
export type { WorkspaceContextValue } from "./workspaceContextValue";

// Hooks
export {
    useWorkspaceContext,
    useWorkspaceQuery,
    useAuthQuery,
    useWorkspaceMutation,
    useAuthMutation,
    useWorkspaceReady,
} from "./useWorkspaceHooks";
