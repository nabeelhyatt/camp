import { Component, ErrorInfo, ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface Props {
    children: ReactNode;
    navigate: (path: string, options?: { replace?: boolean }) => void;
    chatId?: string;
}

interface State {
    hasError: boolean;
    error?: Error;
}

/**
 * Error boundary specifically for chat routes
 *
 * Catches errors from Convex queries (like "Chat not found") and navigates
 * to home instead of showing error screen. This prevents error loops when
 * trying to access non-existent chats.
 */
class ChatErrorBoundaryClass extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Chat error:", error, errorInfo);

        // Navigate to home to avoid error loop
        // Use replace to prevent back button from returning to broken chat
        this.props.navigate("/", { replace: true });

        // Reset error state after a brief delay to allow navigation
        setTimeout(() => {
            this.setState({
                hasError: false,
                error: undefined,
            });
        }, 100);
    }

    public componentDidUpdate(prevProps: Props) {
        // If chatId changes and we had an error, clear it
        if (prevProps.chatId !== this.props.chatId && this.state.hasError) {
            this.setState({
                hasError: false,
                error: undefined,
            });
        }
    }

    public render() {
        // Don't show error UI - just let navigation happen
        // The navigation in componentDidCatch will handle it
        return this.props.children;
    }
}

/**
 * Wrapper component that provides navigate function to the error boundary
 */
export function ChatErrorBoundary({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const { chatId } = useParams();

    return (
        <ChatErrorBoundaryClass navigate={navigate} chatId={chatId}>
            {children}
        </ChatErrorBoundaryClass>
    );
}
