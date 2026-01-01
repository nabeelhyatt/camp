import { useEffect } from "react";
import { XIcon, LockIcon, ArrowUpRightIcon, SendIcon } from "lucide-react";
import { Link } from "react-router-dom";
import ReplyChat from "./ReplyChat";
import * as ChatAPI from "@core/camp/api/UnifiedChatAPI";
import { useSidebar } from "@ui/hooks/useSidebar";
import { Button } from "@ui/components/ui/button";
import { dialogActions } from "@core/infra/DialogStore";
import {
    PublishSummaryDialog,
    PUBLISH_SUMMARY_DIALOG_ID,
} from "./chat/PublishSummaryDialog";
import { campConfig } from "@core/campConfig";

interface RepliesDrawerProps {
    onOpenChange: (open: boolean) => void;
    replyChatId: string;
}

export default function RepliesDrawer({
    onOpenChange,
    replyChatId,
}: RepliesDrawerProps) {
    // Fetch the reply chat via the replyID (which is really just a chat ID in the db)
    const chatQuery = ChatAPI.useChat(replyChatId);
    const { isMobile } = useSidebar();

    // Get parent chat info for the header (only for private replies in Convex mode)
    const chatData = chatQuery.data;
    const parentChatId = chatData?.parentChatId;
    const parentChatQuery = ChatAPI.useChat(parentChatId ?? undefined);

    // Check if this is a private reply (Convex-specific)
    // In Convex mode, chatData is ConvexChat which has visibility field
    const isPrivateReply =
        campConfig.useConvexData &&
        chatData &&
        "visibility" in chatData &&
        chatData.visibility === "private";

    // Handle escape key to close
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onOpenChange(false);
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [onOpenChange]);

    const handlePublishSummary = () => {
        dialogActions.openDialog(PUBLISH_SUMMARY_DIALOG_ID);
    };

    const errorState = (
        <div className="flex items-center justify-center space-x-2 h-full">
            <p className="text-sm text-muted-foreground">Reply not found.</p>
            <button
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
            >
                <XIcon className="size-4" />
            </button>
        </div>
    );

    if (!replyChatId || !chatQuery.data) return errorState;

    const repliedToMessageId = chatQuery.data.replyToId;
    if (!repliedToMessageId) return errorState;

    return (
        <>
            <div className="@2xl:translate-y-[50px] @2xl:h-[calc(100vh-50px)] h-full bg-background flex flex-col transition-all duration-300 ease-in-out overflow-hidden w-full">
                {/* Header */}
                <div
                    className={`flex-shrink-0 transition-opacity duration-300 ${isMobile ? "pt-8" : "pt-4"}`}
                >
                    {isPrivateReply && parentChatId ? (
                        // Private reply header with ForkIndicator style
                        <div className="bg-muted/50 border-b px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                <span className="font-medium text-foreground">
                                    Reply
                                </span>
                                <span className="flex items-center gap-1">
                                    <LockIcon className="w-3 h-3" />
                                    <span>Private</span>
                                </span>
                                <span>from</span>
                                <Link
                                    to={`/chat/${parentChatId}`}
                                    onClick={() => onOpenChange(false)}
                                    className="font-medium text-foreground hover:underline flex items-center gap-1"
                                >
                                    {parentChatQuery.data?.title ||
                                        "parent chat"}
                                    <ArrowUpRightIcon className="w-3 h-3" />
                                </Link>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handlePublishSummary}
                                    className="text-xs"
                                >
                                    <SendIcon className="w-3 h-3 mr-1" />
                                    Publish
                                </Button>
                                <button
                                    onClick={() => onOpenChange(false)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <XIcon className="size-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        // Standard reply header (SQLite mode or non-private)
                        <div className="flex items-center justify-between px-6 pb-3">
                            <p className="font-semibold whitespace-nowrap">
                                Replies
                            </p>
                            <button
                                onClick={() => onOpenChange(false)}
                                className="text-muted-foreground hover:text-foreground transition-colors ml-4"
                            >
                                <XIcon className="size-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Content - ReplyChat for the reply thread */}
                <div className="flex-1 overflow-hidden transition-opacity duration-300">
                    <ReplyChat
                        chatId={replyChatId}
                        replyToId={repliedToMessageId}
                    />
                </div>
            </div>

            {/* Publish summary dialog for private replies */}
            {isPrivateReply && parentChatId && (
                <PublishSummaryDialog
                    chatId={replyChatId}
                    parentChatTitle={parentChatQuery.data?.title}
                />
            )}
        </>
    );
}
