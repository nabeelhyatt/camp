import { useUser, useAuth } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@convex/_generated/api";

/**
 * Hook to get the current authenticated user with their organization and workspace data
 *
 * This hook:
 * 1. Gets the Clerk user (auth provider)
 * 2. Syncs the Clerk user to Convex on sign-in
 * 3. Returns the full user profile from Convex
 */
export function useCurrentUser() {
    const { isLoaded: isAuthLoaded, isSignedIn, userId: clerkId } = useAuth();
    const { user: clerkUser } = useUser();

    // Sync user to Convex
    const syncUser = useMutation(api.auth.syncUser);

    // Get current user from Convex
    const convexUser = useQuery(
        api.auth.getCurrentUser,
        clerkId ? { clerkId } : "skip",
    );

    // Sync Clerk user to Convex when signed in
    useEffect(() => {
        if (isSignedIn && clerkUser && clerkId) {
            // Only sync if we haven't already or user data changed
            const email = clerkUser.primaryEmailAddress?.emailAddress;
            const displayName =
                clerkUser.fullName ||
                clerkUser.firstName ||
                email?.split("@")[0] ||
                "User";
            const avatarUrl = clerkUser.imageUrl;

            if (email) {
                void syncUser({
                    clerkId,
                    email,
                    displayName,
                    avatarUrl,
                });
            }
        }
    }, [isSignedIn, clerkUser, clerkId, syncUser]);

    // Still loading auth
    if (!isAuthLoaded) {
        return {
            isLoading: true,
            isAuthenticated: false,
            user: null,
            organization: null,
            activeWorkspace: null,
            workspaces: [],
            clerkUser: null,
        };
    }

    // Not signed in
    if (!isSignedIn) {
        return {
            isLoading: false,
            isAuthenticated: false,
            user: null,
            organization: null,
            activeWorkspace: null,
            workspaces: [],
            clerkUser: null,
        };
    }

    // Signed in but still loading Convex data
    if (convexUser === undefined) {
        return {
            isLoading: true,
            isAuthenticated: true,
            user: null,
            organization: null,
            activeWorkspace: null,
            workspaces: [],
            clerkUser,
        };
    }

    // Fully loaded
    return {
        isLoading: false,
        isAuthenticated: true,
        user: convexUser?.user ?? null,
        organization: convexUser?.organization ?? null,
        activeWorkspace: convexUser?.activeWorkspace ?? null,
        workspaces: convexUser?.workspaces ?? [],
        clerkUser,
    };
}

/**
 * Hook to check if user needs to complete onboarding
 */
export function useNeedsOnboarding() {
    const { isLoading, isAuthenticated, user } = useCurrentUser();

    if (isLoading) {
        return { isLoading: true, needsOnboarding: false };
    }

    if (!isAuthenticated || !user) {
        // Not authenticated - they need to sign in first
        return { isLoading: false, needsOnboarding: false };
    }

    return {
        isLoading: false,
        needsOnboarding: !user.onboardingCompleted,
    };
}

/**
 * Hook to switch active workspace
 */
export function useSetActiveWorkspace() {
    const { userId: clerkId } = useAuth();
    const setActiveWorkspace = useMutation(api.auth.setActiveWorkspace);

    return async (workspaceId: string) => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }

        // Note: We need to cast the workspaceId to the correct Convex ID type
        // This is handled internally by Convex
        await setActiveWorkspace({
            clerkId,
            workspaceId: workspaceId as any,
        });
    };
}

/**
 * Hook to complete onboarding
 */
export function useCompleteOnboarding() {
    const { userId: clerkId } = useAuth();
    const completeOnboarding = useMutation(api.auth.completeOnboarding);

    return async () => {
        if (!clerkId) {
            throw new Error("Not authenticated");
        }

        await completeOnboarding({ clerkId });
    };
}
