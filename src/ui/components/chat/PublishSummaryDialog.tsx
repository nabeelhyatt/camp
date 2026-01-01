import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@ui/components/ui/dialog";
import { Button } from "@ui/components/ui/button";
import { Textarea } from "@ui/components/ui/textarea";
import { Loader2, SendIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { usePublishSummary } from "@core/camp/api/UnifiedChatAPI";
import { useMessageSets } from "@core/camp/api/UnifiedMessageAPI";
import { simpleLLM } from "@core/chorus/simpleLLM";
import { dialogActions } from "@core/infra/DialogStore";

export const PUBLISH_SUMMARY_DIALOG_ID = "publish-summary-dialog";

interface PublishSummaryDialogProps {
    chatId: string;
    parentChatTitle?: string;
}

/**
 * Dialog for publishing a summary from a private fork to the parent chat.
 * Features:
 * - AI-powered summary generation from conversation
 * - Manual editing before publishing
 * - Publishes to parent chat via Convex
 */
export function PublishSummaryDialog({
    chatId,
    parentChatTitle,
}: PublishSummaryDialogProps) {
    const [summary, setSummary] = useState("");
    const [isPublishing, setIsPublishing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const publishSummary = usePublishSummary();
    const messageSetsQuery = useMessageSets(chatId);

    const handleGenerateSummary = async () => {
        if (!messageSetsQuery.data || messageSetsQuery.data.length === 0) {
            toast.error("No messages to summarize");
            return;
        }

        setIsGenerating(true);
        try {
            // Build conversation text from message sets
            const conversationText = messageSetsQuery.data
                .map((set) => {
                    const parts: string[] = [];

                    // User message
                    if (set.userBlock?.message?.text) {
                        parts.push(`User: ${set.userBlock.message.text}`);
                    }

                    // AI responses from toolsBlock
                    if (set.toolsBlock?.chatMessages) {
                        set.toolsBlock.chatMessages.forEach((msg) => {
                            if (msg.text) {
                                parts.push(`Assistant: ${msg.text}`);
                            }
                        });
                    }

                    return parts.join("\n");
                })
                .filter(Boolean)
                .join("\n\n");

            if (!conversationText.trim()) {
                toast.error("No content to summarize");
                setIsGenerating(false);
                return;
            }

            const prompt = `Summarize the key insights from this conversation in 2-3 sentences for sharing with the team. Focus on what was discovered or decided, not the back-and-forth of the conversation.

Conversation:
${conversationText}

Summary:`;

            const generatedSummary = await simpleLLM(prompt, {
                model: "claude-sonnet-4-20250514",
                maxTokens: 300,
            });

            setSummary(generatedSummary.trim());
            toast.success("Summary generated", {
                description: "Review and edit before publishing.",
            });
        } catch (error) {
            console.error("Failed to generate summary:", error);
            toast.error("Failed to generate summary", {
                description:
                    error instanceof Error
                        ? error.message
                        : "Please try again or write manually.",
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePublish = async () => {
        if (!summary.trim()) {
            toast.error("Please enter a summary");
            return;
        }

        setIsPublishing(true);
        try {
            await publishSummary.mutateAsync({
                chatId,
                summary: summary.trim(),
            });
            toast.success("Summary published", {
                description: `Your summary has been posted to ${parentChatTitle || "the parent chat"}.`,
            });
            dialogActions.closeDialog(PUBLISH_SUMMARY_DIALOG_ID);
            setSummary("");
        } catch (error) {
            console.error("Failed to publish summary:", error);
            toast.error("Failed to publish summary", {
                description:
                    error instanceof Error
                        ? error.message
                        : "Please try again.",
            });
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <Dialog id={PUBLISH_SUMMARY_DIALOG_ID}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Publish Summary</DialogTitle>
                    <DialogDescription>
                        Share your findings with the team in{" "}
                        <span className="font-medium text-foreground">
                            {parentChatTitle || "the parent chat"}
                        </span>
                        .
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleGenerateSummary()}
                        disabled={isGenerating || isPublishing}
                        className="w-full"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-4 h-4 mr-2" />
                                Generate Summary
                            </>
                        )}
                    </Button>

                    <Textarea
                        placeholder="Summarize what you explored and discovered..."
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        className="min-h-[150px]"
                        disabled={isGenerating}
                    />
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() =>
                            dialogActions.closeDialog(PUBLISH_SUMMARY_DIALOG_ID)
                        }
                        disabled={isPublishing}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handlePublish()}
                        disabled={
                            isPublishing || isGenerating || !summary.trim()
                        }
                    >
                        {isPublishing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Publishing...
                            </>
                        ) : (
                            <>
                                <SendIcon className="w-4 h-4 mr-2" />
                                Publish
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
