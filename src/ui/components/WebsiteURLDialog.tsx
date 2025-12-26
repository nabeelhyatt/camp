import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@ui/components/ui/dialog";
import { Button } from "@ui/components/ui/button";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";
import { dialogActions, useDialogStore } from "@core/infra/DialogStore";
import AutoExpandingTextarea from "./AutoExpandingTextarea";

export const WEBSITE_URL_DIALOG_ID = "website-url-dialog";

interface WebsiteURLDialogProps {
    onAddUrls: (urls: string[]) => Promise<void>;
}

export default function WebsiteURLDialog({ onAddUrls }: WebsiteURLDialogProps) {
    const [urlText, setUrlText] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const isOpen = useDialogStore(
        (state) => state.activeDialogId === WEBSITE_URL_DIALOG_ID,
    );

    const parseUrls = (text: string): string[] => {
        // Split by whitespace or newlines and extract URL-like strings
        const words = text.split(/\s+/).filter((w) => w.length > 0);
        const urls: string[] = [];

        for (const word of words) {
            let url = word.trim();
            // Skip empty strings
            if (!url) continue;

            // Check if it looks like a URL (has a dot and no spaces)
            if (url.includes(".") && !url.includes(" ")) {
                // Add https:// if no protocol specified
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    url = "https://" + url;
                }
                urls.push(url);
            }
        }

        return [...new Set(urls)]; // Remove duplicates
    };

    const handleInsert = async () => {
        const urls = parseUrls(urlText);

        if (urls.length === 0) {
            toast.error("No valid URLs found", {
                description: "Please enter website URLs (e.g., example.com)",
            });
            return;
        }

        if (urls.length > 10) {
            toast.error("Too many URLs", {
                description: "Please enter at most 10 URLs at a time",
            });
            return;
        }

        setIsLoading(true);
        try {
            await onAddUrls(urls);
            setUrlText("");
            dialogActions.closeDialog();
            toast.success(
                `Adding ${urls.length} URL${urls.length > 1 ? "s" : ""}`,
                {
                    description: "Scraping website content...",
                },
            );
        } catch (error) {
            toast.error("Failed to add URLs", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setUrlText("");
            dialogActions.closeDialog();
        }
    };

    const urlCount = parseUrls(urlText).length;

    return (
        <Dialog
            id={WEBSITE_URL_DIALOG_ID}
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) handleClose();
            }}
        >
            <DialogContent className="sm:max-w-lg p-5">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link2 className="size-5" />
                        Website and YouTube URLs
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        Paste in Website and YouTube URLs below to upload as a
                        source in your group project.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    <div className="border border-primary/50 rounded-lg overflow-hidden focus-within:border-primary">
                        <AutoExpandingTextarea
                            value={urlText}
                            onChange={(e) => setUrlText(e.target.value)}
                            placeholder="Paste any links"
                            className="w-full p-3 min-h-[150px] max-h-[300px] resize-none border-0 focus:ring-0 focus:outline-none"
                            rows={6}
                            disabled={isLoading}
                        />
                    </div>

                    <ul className="mt-4 text-sm text-muted-foreground space-y-1">
                        <li className="flex items-start gap-2">
                            <span className="text-muted-foreground/70">•</span>
                            To add multiple URLs, separate with a space or new
                            line
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-muted-foreground/70">•</span>
                            Only the visible text on the website will be
                            imported
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-muted-foreground/70">•</span>
                            Paid articles are not supported
                        </li>
                    </ul>
                </div>

                <div className="flex justify-end mt-4">
                    <Button
                        onClick={() => void handleInsert()}
                        disabled={isLoading || urlCount === 0}
                        className="min-w-[100px]"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="size-4 mr-2 animate-spin" />
                                Adding...
                            </>
                        ) : (
                            <>
                                Insert
                                {urlCount > 0 && (
                                    <span className="ml-1 text-xs opacity-70">
                                        ({urlCount})
                                    </span>
                                )}
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
