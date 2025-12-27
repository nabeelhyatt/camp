import { ClerkProvider as ClerkReactProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { campConfig } from "@core/campConfig";
import { ReactNode, useMemo } from "react";

/**
 * Combined Clerk + Convex provider for Camp
 *
 * This provider:
 * 1. Wraps the app with Clerk for authentication
 * 2. Connects Clerk to Convex for authenticated database access
 * 3. Handles deep link callbacks for OAuth flow in Tauri
 */

interface CampAuthProviderProps {
    children: ReactNode;
}

export function CampAuthProvider({ children }: CampAuthProviderProps) {
    // Create Convex client once
    const convexClient = useMemo(() => {
        return new ConvexReactClient(campConfig.convexUrl);
    }, []);

    return (
        <ClerkReactProvider
            publishableKey={campConfig.clerkPublishableKey}
            afterSignOutUrl="/"
        >
            <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
                {children}
            </ConvexProviderWithClerk>
        </ClerkReactProvider>
    );
}

export { useAuth };
