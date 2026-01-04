import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ProviderName } from "@core/chorus/Models";
import { ProviderLogo } from "./ui/provider-logo";
import { Card } from "./ui/card";
import { CheckIcon, FlameIcon, Users } from "lucide-react";
import { useState, useMemo } from "react";
import { PrivateTeamToggle } from "./ui/PrivateTeamToggle";
import { TeamKeyPicker } from "./ui/TeamKeyPicker";
import { TeamApiKey } from "@core/camp/api/TeamApiKeysAPI";

interface ApiKeysFormProps {
    apiKeys: Record<string, string>;
    onApiKeyChange: (provider: string, value: string) => void;
    // Team sharing props (optional for backward compatibility)
    teamApiKeys?: TeamApiKey[];
    userSharedProviders?: string[];
    onShareKey?: (provider: string) => void;
    onUnshareKey?: (provider: string) => void;
    onSelectTeamKey?: (key: TeamApiKey) => void;
}

export default function ApiKeysForm({
    apiKeys,
    onApiKeyChange,
    teamApiKeys,
    userSharedProviders = [],
    onShareKey,
    onUnshareKey,
    onSelectTeamKey,
}: ApiKeysFormProps) {
    const [selectedProvider, setSelectedProvider] = useState<string | null>(
        null,
    );

    // Get team keys for the selected provider
    const teamKeysForProvider = useMemo(() => {
        if (!selectedProvider || !teamApiKeys) return [];
        return teamApiKeys.filter((key) => key.provider === selectedProvider);
    }, [selectedProvider, teamApiKeys]);

    // Check if the user has shared a key for the selected provider
    const isSharedByUser = useMemo(() => {
        if (!selectedProvider) return false;
        return userSharedProviders.includes(selectedProvider);
    }, [selectedProvider, userSharedProviders]);

    // Handle toggle between private and team
    const handleShareToggle = (isTeam: boolean) => {
        if (!selectedProvider) return;
        if (isTeam && onShareKey) {
            onShareKey(selectedProvider);
        } else if (!isTeam && onUnshareKey) {
            onUnshareKey(selectedProvider);
        }
    };

    const providers = [
        {
            id: "anthropic",
            name: "Anthropic",
            placeholder: "sk-ant-...",
            url: "https://console.anthropic.com/settings/keys",
        },
        {
            id: "openai",
            name: "OpenAI",
            placeholder: "sk-...",
            url: "https://platform.openai.com/api-keys",
        },
        {
            id: "google",
            name: "Google AI (Gemini)",
            placeholder: "AI...",
            url: "https://aistudio.google.com/apikey",
        },
        {
            id: "perplexity",
            name: "Perplexity",
            placeholder: "pplx-...",
            url: "https://www.perplexity.ai/account/api/keys",
        },
        {
            id: "openrouter",
            name: "OpenRouter",
            placeholder: "sk-or-...",
            url: "https://openrouter.ai/keys",
        },
        {
            id: "grok",
            name: "xAI",
            placeholder: "xai-...",
            url: "https://console.x.ai/settings/keys",
        },
        {
            id: "firecrawl",
            name: "Firecrawl",
            placeholder: "fc-...",
            url: "https://www.firecrawl.dev/app/api-keys",
        },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                {providers.map((provider) => (
                    <Card
                        key={provider.id}
                        className={`relative p-6 cursor-pointer hover:bg-muted transition-colors ${
                            selectedProvider === provider.id
                                ? "ring-2 ring-primary"
                                : ""
                        }`}
                        onClick={() => setSelectedProvider(provider.id)}
                    >
                        <div className="flex flex-col items-center gap-2 text-center">
                            {provider.id === "firecrawl" ? (
                                <FlameIcon className="w-4 h-4" />
                            ) : (
                                <ProviderLogo
                                    provider={provider.id as ProviderName}
                                    size="lg"
                                />
                            )}
                            <span className="font-medium">{provider.name}</span>
                        </div>
                        {/* Show check if user has their own key */}
                        {apiKeys[provider.id] && (
                            <div className="absolute top-2 right-2">
                                <CheckIcon className="w-4 h-4 text-green-500" />
                            </div>
                        )}
                        {/* Show team indicator if team keys exist for this provider */}
                        {teamApiKeys?.some(
                            (k) => k.provider === provider.id,
                        ) && (
                            <div className="absolute top-2 left-2">
                                <Users className="w-3 h-3 text-muted-foreground" />
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            {selectedProvider && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                    {/* Your Key Section */}
                    <div className="space-y-3 border rounded-lg p-4">
                        <h4 className="font-medium text-sm text-muted-foreground">
                            Your Key
                        </h4>
                        <div className="space-y-2">
                            <Label htmlFor={`${selectedProvider}-key`}>
                                {
                                    providers.find(
                                        (p) => p.id === selectedProvider,
                                    )?.name
                                }{" "}
                                API Key
                            </Label>
                            <Input
                                id={`${selectedProvider}-key`}
                                type="password"
                                placeholder={
                                    providers.find(
                                        (p) => p.id === selectedProvider,
                                    )?.placeholder
                                }
                                value={apiKeys[selectedProvider] || ""}
                                onChange={(e) =>
                                    onApiKeyChange(
                                        selectedProvider,
                                        e.target.value,
                                    )
                                }
                            />
                            <p className="text-sm text-muted-foreground">
                                <a
                                    href={
                                        providers.find(
                                            (p) => p.id === selectedProvider,
                                        )?.url
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Get{" "}
                                    {
                                        providers.find(
                                            (p) => p.id === selectedProvider,
                                        )?.name
                                    }{" "}
                                    API key
                                </a>
                                .
                            </p>
                        </div>

                        {/* Private/Team Toggle - only show if user has a key and sharing is enabled */}
                        {apiKeys[selectedProvider] &&
                            onShareKey &&
                            onUnshareKey && (
                                <div className="pt-2 border-t">
                                    <PrivateTeamToggle
                                        isTeam={isSharedByUser}
                                        onToggle={handleShareToggle}
                                    />
                                </div>
                            )}
                    </div>

                    {/* Team Keys Section - only show if there are team keys */}
                    {teamKeysForProvider.length > 0 && onSelectTeamKey && (
                        <div className="border rounded-lg p-4">
                            <TeamKeyPicker
                                teamKeys={teamKeysForProvider}
                                onSelect={onSelectTeamKey}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
