import { LockIcon, ArrowUpRightIcon, SendIcon } from "lucide-react";
import { Button } from "@ui/components/ui/button";
import { Link } from "react-router-dom";

interface ForkIndicatorProps {
    parentChatId: string;
    parentChatTitle?: string;
    forkDepth?: number;
    onPublishSummary: () => void;
}

/**
 * Banner shown at the top of private fork chats
 * Indicates this is a private exploration and provides:
 * - Visual indicator of privacy (lock icon)
 * - Link back to parent chat
 * - Button to publish summary to parent
 */
export function ForkIndicator({
    parentChatId,
    parentChatTitle,
    forkDepth = 1,
    onPublishSummary,
}: ForkIndicatorProps) {
    return (
        <div className="bg-muted/50 border-b px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Reply</span>
                <span className="flex items-center gap-1">
                    <LockIcon className="w-3 h-3" />
                    <span>Private</span>
                </span>
                <span>from</span>
                <Link
                    to={`/chat/${parentChatId}`}
                    className="font-medium text-foreground hover:underline flex items-center gap-1"
                >
                    {parentChatTitle || "parent chat"}
                    <ArrowUpRightIcon className="w-3 h-3" />
                </Link>
                {forkDepth > 1 && (
                    <span className="text-xs text-muted-foreground/60">
                        (depth {forkDepth})
                    </span>
                )}
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={onPublishSummary}
                className="text-xs"
            >
                <SendIcon className="w-3 h-3 mr-1" />
                Publish
            </Button>
        </div>
    );
}
