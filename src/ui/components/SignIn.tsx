import { SignIn as ClerkSignIn, useAuth } from "@clerk/clerk-react";
import RetroSpinner from "./ui/retro-spinner";

/**
 * Sign-in screen for Camp
 *
 * This component shows the Clerk sign-in UI when user is not authenticated.
 * Uses Clerk's pre-built SignIn component with Google OAuth.
 */
export default function SignIn() {
    const { isLoaded } = useAuth();

    // Still loading Clerk
    if (!isLoaded) {
        return (
            <div
                data-tauri-drag-region
                className="fixed inset-0 z-50 flex flex-col items-center justify-center min-h-screen bg-background/95 backdrop-blur-sm px-4"
            >
                <div className="flex flex-col items-center gap-4">
                    <RetroSpinner />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div
            data-tauri-drag-region
            className="fixed inset-0 z-50 flex flex-col items-center justify-center min-h-screen bg-background/95 backdrop-blur-sm px-4"
        >
            <div className="text-center space-y-6 max-w-md w-full">
                <div className="space-y-2 mb-8">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Welcome to Camp
                    </h1>
                    <p className="text-muted-foreground">
                        Multiplayer AI workspace for group projects.
                    </p>
                </div>

                <div className="flex justify-center">
                    <ClerkSignIn
                        appearance={{
                            elements: {
                                rootBox: "w-full",
                                card: "bg-card border shadow-none",
                                headerTitle: "hidden",
                                headerSubtitle: "hidden",
                                socialButtonsBlockButton:
                                    "bg-background border hover:bg-accent",
                                socialButtonsBlockButtonText: "font-medium",
                                dividerLine: "bg-border",
                                dividerText: "text-muted-foreground",
                                formFieldLabel: "text-foreground",
                                formFieldInput:
                                    "bg-background border-input focus:ring-ring",
                                formButtonPrimary:
                                    "bg-primary text-primary-foreground hover:bg-primary/90",
                                footerActionLink:
                                    "text-primary hover:text-primary/90",
                                identityPreviewText: "text-foreground",
                                identityPreviewEditButton:
                                    "text-primary hover:text-primary/90",
                            },
                            layout: {
                                socialButtonsPlacement: "top",
                                socialButtonsVariant: "blockButton",
                            },
                        }}
                        routing="hash"
                        signUpUrl={undefined} // Disable sign up - users sign in only
                        afterSignInUrl="/"
                    />
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                    Sign in with your Google account to get started.
                    <br />
                    Your email domain determines your team workspace.
                </p>
            </div>
        </div>
    );
}

/**
 * Auth guard component that shows sign-in if not authenticated
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isLoaded, isSignedIn } = useAuth();

    // Still loading
    if (!isLoaded) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center min-h-screen bg-background">
                <RetroSpinner />
                <p className="text-sm text-muted-foreground mt-4">Loading...</p>
            </div>
        );
    }

    // Not signed in - show sign-in screen
    if (!isSignedIn) {
        return <SignIn />;
    }

    // Signed in - render children
    return <>{children}</>;
}
