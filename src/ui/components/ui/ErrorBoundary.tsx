import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./button";
import posthog from "posthog-js";
import FeedbackButton from "../FeedbackButton";
import { getVersion } from "@tauri-apps/api/app";
import { config } from "@core/config";
import { useNavigate } from "react-router-dom";

interface Props {
    children: ReactNode;
    navigate?: (path: string, options?: { replace?: boolean }) => void;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
    shouldNavigateHome: boolean;
}

class ErrorBoundaryClass extends Component<Props, State> {
    public state: State = {
        hasError: false,
        shouldNavigateHome: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        // Don't show error UI for "Chat not found" errors - we'll navigate away instead
        if (error.message && error.message.includes("Chat not found")) {
            return { hasError: false, shouldNavigateHome: true };
        }
        return { hasError: true, error, shouldNavigateHome: false };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);

        // If this is a "Chat not found" error, navigate using React Router if available
        if (error.message && error.message.includes("Chat not found")) {
            console.log("Chat not found error detected, navigating to home...");
            if (this.props.navigate) {
                this.props.navigate("/", { replace: true });
            } else {
                // Fallback to window.location if navigate not available
                window.location.href = "/";
            }
            return;
        }

        // Save errorInfo to state so we can show it in UI
        this.setState({ errorInfo });

        // don't capture errors when we're in dev mode, it's too noisy
        if (!config.tellPostHogIAmATestUser) {
            void getVersion().then((version) =>
                posthog.capture("app_errored", {
                    error_message: error.message,
                    error_name: error.name,
                    error_stack: error.stack,
                    component_stack: errorInfo.componentStack,
                    version,
                }),
            );
        }
    }

    private handleReload = () => {
        // Navigate using React Router if available, otherwise fallback to window.location
        if (this.props.navigate) {
            this.props.navigate("/", { replace: true });
        } else {
            window.location.href = "/";
        }

        // Reset error state
        this.setState({
            hasError: false,
            error: undefined,
            errorInfo: undefined,
            shouldNavigateHome: false,
        });
    };

    public render() {
        // If we should navigate home (chat not found), just render children
        // The navigation will happen in componentDidCatch
        if (this.state.shouldNavigateHome) {
            return null;
        }

        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen p-4">
                    <div className="text-center max-w-md">
                        <h2 className="text-2xl font-bold mb-4">
                            Uh-oh! Something went wrong.
                        </h2>
                        {this.state.error && (
                            <p className="mb-6 text-muted-foreground">
                                Error: {this.state.error.message}
                            </p>
                        )}
                        <div className="flex items-center justify-center gap-6">
                            <FeedbackButton className="hover:bg-gray-100 p-2 rounded-md">
                                Send us a bug report
                            </FeedbackButton>
                            <Button onClick={this.handleReload}>
                                Go to Home Screen
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Wrapper component that provides React Router's navigate to the error boundary
 */
function ErrorBoundary({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    return (
        <ErrorBoundaryClass navigate={navigate}>{children}</ErrorBoundaryClass>
    );
}

export default ErrorBoundary;
