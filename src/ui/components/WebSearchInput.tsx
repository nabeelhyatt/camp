import { useState } from "react";
import { Search, ArrowRight, Loader2, Plus } from "lucide-react";
import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
import { toast } from "sonner";
import { WebTools } from "@core/chorus/WebTools";
import { getApiKeys } from "@core/chorus/api/AppMetadataAPI";
import { cn } from "@ui/lib/utils";

interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

interface WebSearchInputProps {
    onAddUrl: (url: string) => Promise<void>;
    className?: string;
}

export default function WebSearchInput({
    onAddUrl,
    className,
}: WebSearchInputProps) {
    const [query, setQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [addingUrl, setAddingUrl] = useState<string | null>(null);

    const parseSearchResults = (content: string): SearchResult[] => {
        // Parse the search results from Perplexity response
        // The response includes markdown content with sources at the end
        const results: SearchResult[] = [];

        // Extract URLs from the Sources section
        const sourcesMatch = content.match(/Sources:\n([\s\S]*?)$/);
        if (sourcesMatch) {
            const sourcesText = sourcesMatch[1];
            const urlMatches = sourcesText.matchAll(
                /\d+\.\s*\[([^\]]+)\]\(([^)]+)\)/g,
            );

            for (const match of urlMatches) {
                const url = match[2];
                const title = match[1] || url;
                results.push({
                    title:
                        title.length > 60
                            ? title.substring(0, 60) + "..."
                            : title,
                    url,
                    snippet: "", // Perplexity doesn't give us individual snippets
                });
            }
        }

        return results;
    };

    const handleSearch = async () => {
        if (!query.trim()) return;

        setIsSearching(true);
        setShowResults(true);
        setResults([]);

        try {
            const apiKeys = await getApiKeys();

            if (!apiKeys.perplexity && !apiKeys.openrouter) {
                toast.error("API key required", {
                    description:
                        "Please add your Perplexity or OpenRouter API key in Settings to use web search.",
                });
                setShowResults(false);
                return;
            }

            const result = await WebTools.search(query, apiKeys);

            if (result.error) {
                toast.error("Search failed", {
                    description: result.error,
                });
                setShowResults(false);
                return;
            }

            const parsed = parseSearchResults(result.content);
            setResults(parsed);

            if (parsed.length === 0) {
                toast("No sources found", {
                    description: "Try a different search query.",
                });
            }
        } catch (error) {
            toast.error("Search failed", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
            setShowResults(false);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddResult = async (url: string) => {
        setAddingUrl(url);
        try {
            await onAddUrl(url);
            // Remove the added result from the list
            setResults((prev) => prev.filter((r) => r.url !== url));
            toast.success("Source added", {
                description: "Website content is being scraped...",
            });
        } catch (error) {
            toast.error("Failed to add source", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        } finally {
            setAddingUrl(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            void handleSearch();
        }
        if (e.key === "Escape") {
            setShowResults(false);
        }
    };

    return (
        <div className={cn("relative", className)}>
            <div className="flex items-center rounded-lg bg-muted/50 focus-within:bg-background focus-within:ring-1 focus-within:ring-border transition-colors">
                <div className="pl-3 text-muted-foreground">
                    <Search className="size-4" />
                </div>
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => results.length > 0 && setShowResults(true)}
                    placeholder="Search the web for sources..."
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={isSearching}
                />
                <Button
                    variant="ghost"
                    size="icon"
                    className="mr-1 rounded-full"
                    onClick={() => void handleSearch()}
                    disabled={isSearching || !query.trim()}
                >
                    {isSearching ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <ArrowRight className="size-4" />
                    )}
                </Button>
            </div>

            {/* Results dropdown */}
            {showResults && (results.length > 0 || isSearching) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-50 max-h-[300px] overflow-y-auto">
                    {isSearching ? (
                        <div className="p-4 text-center text-muted-foreground">
                            <Loader2 className="size-5 animate-spin mx-auto mb-2" />
                            Searching...
                        </div>
                    ) : (
                        <div className="p-2">
                            <div className="text-xs text-muted-foreground px-2 py-1 mb-1">
                                Click to add as source ({results.length} found)
                            </div>
                            {results.map((result, index) => (
                                <button
                                    key={index}
                                    className="w-full text-left p-2 hover:bg-muted rounded-md flex items-center justify-between gap-2 group"
                                    onClick={() =>
                                        void handleAddResult(result.url)
                                    }
                                    disabled={addingUrl === result.url}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">
                                            {result.title}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">
                                            {result.url}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {addingUrl === result.url ? (
                                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                        ) : (
                                            <Plus className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Click outside to close */}
            {showResults && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowResults(false)}
                />
            )}
        </div>
    );
}
