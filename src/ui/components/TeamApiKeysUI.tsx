/**
 * Team API Keys UI Components for Camp Multiplayer
 *
 * Components for displaying and managing team-shared API keys:
 * - TeamApiKeyRow: Display a team API key with sharer avatar
 * - ShareApiKeyDialog: Inline form for sharing an API key with team
 */

import { useState } from "react";
import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
import { Label } from "@ui/components/ui/label";
import { Badge } from "@ui/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/ui/avatar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@ui/components/ui/tooltip";
import { Trash2, Users, X, Key } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@convex/_generated/dataModel";
import {
    TeamApiKey,
    getProviderDisplayName,
} from "@core/camp/api/TeamApiKeysAPI";
import { ProviderLogo } from "./ui/provider-logo";
import { ProviderName } from "@core/chorus/Models";

// ============================================================
// TeamApiKeyRow Component
// ============================================================

interface TeamApiKeyRowProps {
    apiKey: TeamApiKey;
    onUnshare?: (keyId: Id<"apiKeys">) => void;
}

/**
 * Display a team API key with sharer attribution
 */
export function TeamApiKeyRow({ apiKey, onUnshare }: TeamApiKeyRowProps) {
    const providerName = getProviderDisplayName(apiKey.provider);

    return (
        <div className="flex items-center justify-between p-4 border rounded-lg shadow-sm bg-card">
            <div className="flex items-center gap-3">
                {/* Provider logo */}
                <ProviderLogo
                    provider={apiKey.provider as ProviderName}
                    size="md"
                />

                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-card-foreground">
                            {providerName}
                        </span>

                        {/* Team badge */}
                        <Badge
                            variant="outline"
                            className="text-muted-foreground"
                        >
                            <Users className="h-3 w-3 mr-1" />
                            Team
                        </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {/* Sharer avatar */}
                        {apiKey.sharerSnapshot && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1">
                                        <Avatar className="h-4 w-4">
                                            <AvatarImage
                                                src={
                                                    apiKey.sharerSnapshot
                                                        .avatarUrl
                                                }
                                                alt={
                                                    apiKey.sharerSnapshot
                                                        .displayName
                                                }
                                            />
                                            <AvatarFallback className="text-[8px]">
                                                {getInitials(
                                                    apiKey.sharerSnapshot
                                                        .displayName,
                                                )}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span>
                                            Shared by{" "}
                                            {apiKey.isSharer
                                                ? "you"
                                                : apiKey.sharerSnapshot
                                                      .displayName}
                                        </span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    {apiKey.sharerSnapshot.displayName}
                                </TooltipContent>
                            </Tooltip>
                        )}

                        {/* Key hint */}
                        <span className="font-mono">
                            <Key className="inline h-3 w-3 mr-1" />
                            ****{apiKey.keyHint}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Unshare button (only for sharer) */}
                {apiKey.isSharer && onUnshare && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="iconSm"
                                onClick={() => onUnshare(apiKey._id)}
                                title="Remove from team"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            Remove from team
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </div>
    );
}

// ============================================================
// ShareApiKeyDialog Component (Inline Form)
// ============================================================

interface ShareApiKeyDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onShare: (provider: string, apiKey: string) => Promise<void>;
    existingProviders: string[];
}

const SHAREABLE_PROVIDERS = [
    {
        id: "anthropic",
        name: "Anthropic",
        placeholder: "sk-ant-...",
    },
    {
        id: "openai",
        name: "OpenAI",
        placeholder: "sk-...",
    },
    {
        id: "google",
        name: "Google AI",
        placeholder: "AI...",
    },
    {
        id: "perplexity",
        name: "Perplexity",
        placeholder: "pplx-...",
    },
    {
        id: "openrouter",
        name: "OpenRouter",
        placeholder: "sk-or-...",
    },
    {
        id: "grok",
        name: "xAI",
        placeholder: "xai-...",
    },
];

/**
 * Inline form for sharing an API key with the team
 */
export function ShareApiKeyDialog({
    isOpen,
    onClose,
    onShare,
    existingProviders,
}: ShareApiKeyDialogProps) {
    const [selectedProvider, setSelectedProvider] = useState<string>("");
    const [apiKeyValue, setApiKeyValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter out providers user already has shared
    const availableProviders = SHAREABLE_PROVIDERS.filter(
        (p) => !existingProviders.includes(p.id),
    );

    const handleShare = async () => {
        if (!selectedProvider) {
            setError("Please select a provider");
            return;
        }
        if (!apiKeyValue.trim()) {
            setError("Please enter an API key");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await onShare(selectedProvider, apiKeyValue);
            toast.success("API key shared with team");
            onClose();
            setSelectedProvider("");
            setApiKeyValue("");
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Failed to share API key",
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
        setSelectedProvider("");
        setApiKeyValue("");
        setError(null);
    };

    if (!isOpen) return null;

    return (
        <div className="space-y-4 border rounded-md p-4 max-w-full overflow-hidden mt-4 bg-muted/50">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold">Share API Key with Team</h4>
                <Button
                    variant="ghost"
                    size="iconSm"
                    onClick={handleClose}
                    title="Close"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <p className="text-sm text-muted-foreground">
                Share your API key so team members can use it. They won&apos;t
                see the key itself, just that it&apos;s available.
            </p>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="share-provider">Provider</Label>
                    <select
                        id="share-provider"
                        className="w-full border rounded-md p-2 bg-background"
                        value={selectedProvider}
                        onChange={(e) => {
                            setSelectedProvider(e.target.value);
                            setError(null);
                        }}
                    >
                        <option value="">Select a provider...</option>
                        {availableProviders.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                                {provider.name}
                            </option>
                        ))}
                    </select>
                </div>

                {selectedProvider && (
                    <div className="space-y-2">
                        <Label htmlFor="share-api-key">API Key</Label>
                        <Input
                            id="share-api-key"
                            type="password"
                            value={apiKeyValue}
                            onChange={(e) => {
                                setApiKeyValue(e.target.value);
                                setError(null);
                            }}
                            placeholder={
                                SHAREABLE_PROVIDERS.find(
                                    (p) => p.id === selectedProvider,
                                )?.placeholder
                            }
                        />
                    </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
                <Button variant="outline" size="sm" onClick={handleClose}>
                    Cancel
                </Button>
                <Button
                    size="sm"
                    onClick={() => void handleShare()}
                    disabled={isLoading || !selectedProvider || !apiKeyValue}
                >
                    {isLoading ? "Sharing..." : "Share with team"}
                </Button>
            </div>
        </div>
    );
}

// ============================================================
// Utilities
// ============================================================

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}
