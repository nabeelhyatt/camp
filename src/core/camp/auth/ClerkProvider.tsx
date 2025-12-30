import {
    ClerkProvider as ClerkReactProvider,
    useAuth,
} from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { campConfig } from "@core/campConfig";
import { ReactNode, useMemo } from "react";
import { ConvexWorkspaceProvider } from "@core/camp/api/ConvexWorkspaceProvider";

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
            appearance={{
                variables: {
                    colorBackground: "#1a1a1a",
                    colorText: "#ffffff",
                    colorTextSecondary: "#a0a0a0",
                    colorPrimary: "#ffffff",
                },
                elements: {
                    card: {
                        backgroundColor: "#1a1a1a",
                    },
                    socialButtonsBlockButton: {
                        color: "#ffffff",
                        backgroundColor: "#2a2a2a",
                        "&:hover": {
                            backgroundColor: "#3a3a3a",
                        },
                    },
                    socialButtonsBlockButtonText: {
                        color: "#ffffff",
                    },
                },
            }}
        >
            <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
                <ConvexWorkspaceProvider>{children}</ConvexWorkspaceProvider>
            </ConvexProviderWithClerk>
        </ClerkReactProvider>
    );
}
