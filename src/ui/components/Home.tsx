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

    useEffect(() => {
        // Skip if using Convex and workspace context isn't ready yet
        if (campConfig.useConvexData && !workspaceReady) {
            return;
        }

        if (isQuickChatWindow && getOrCreateNewQuickChat.isIdle) {
            getOrCreateNewQuickChat.mutate();
        } else if (!isQuickChatWindow && getOrCreateNewChat.isIdle) {
            // Automatically create a new chat and redirect
            getOrCreateNewChat.mutate({ projectId: "default" });
        }
        // For Convex, re-run when workspace becomes ready
    }, [
        workspaceReady,
        isQuickChatWindow,
        getOrCreateNewChat,
        getOrCreateNewQuickChat,
    ]);

    // Show spinner while creating/redirecting
    return (
        <div className="flex h-screen items-center justify-center">
            <RetroSpinner />
        </div>
    );
}
