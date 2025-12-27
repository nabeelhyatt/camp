/**
 * Camp Authentication Module
 *
 * Exports for Clerk + Convex authentication integration
 */

export { CampAuthProvider } from "./ClerkProvider";
export {
    useCurrentUser,
    useNeedsOnboarding,
    useSetActiveWorkspace,
    useCompleteOnboarding,
} from "./useCurrentUser";

// Re-export useAuth from Clerk for convenience
// This is in a separate export to avoid fast refresh issues
export { useAuth } from "@clerk/clerk-react";
