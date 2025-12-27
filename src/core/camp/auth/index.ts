/**
 * Camp Authentication Module
 *
 * Exports for Clerk + Convex authentication integration
 */

export { CampAuthProvider, useAuth } from "./ClerkProvider";
export {
    useCurrentUser,
    useNeedsOnboarding,
    useSetActiveWorkspace,
    useCompleteOnboarding,
} from "./useCurrentUser";
