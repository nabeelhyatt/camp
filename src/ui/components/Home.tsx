import { useAppContext } from "@ui/hooks/useAppContext";
import RetroSpinner from "./ui/retro-spinner";
import * as ChatAPI from "@core/camp/api/UnifiedChatAPI";
import { useWorkspaceReady } from "@core/camp/api/useWorkspaceHooks";
import { campConfig } from "@core/campConfig";
import { useEffect } from "react";

export default function Home() {
    const { isQuickChatWindow } = useAppContext();
    const getOrCreateNewChat = ChatAPI.useGetOrCreateNewChat();
    const getOrCreateNewQuickChat = ChatAPI.useGetOrCreateNewQuickChat();

    // For Convex, we need to wait for workspace context to be ready
    const { isReady: workspaceReady } = useWorkspaceReady();

    // Extract stable values to prevent effect reruns when hook status changes
    const chatIsIdle = getOrCreateNewChat.isIdle;
    const quickChatIsIdle = getOrCreateNewQuickChat.isIdle;

    useEffect(() => {
        // Skip if using Convex and workspace context isn't ready yet
        if (campConfig.useConvexData && !workspaceReady) {
            return;
        }

        if (isQuickChatWindow && quickChatIsIdle) {
            getOrCreateNewQuickChat.mutate();
        } else if (!isQuickChatWindow && chatIsIdle) {
            // Automatically create a new chat and redirect
            getOrCreateNewChat.mutate({ projectId: "default" });
        }
        // Note: Only depend on stable triggers. The mutation hooks have internal
        // guards against duplicate calls, but we avoid including the full hook
        // objects in deps to prevent unnecessary effect reruns.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceReady, isQuickChatWindow, chatIsIdle, quickChatIsIdle]);

    // Show spinner while creating/redirecting
    return (
        <div className="flex h-screen items-center justify-center">
            <RetroSpinner />
        </div>
    );
}
