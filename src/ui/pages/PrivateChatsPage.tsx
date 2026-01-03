import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SearchIcon, LockIcon } from "lucide-react";
import * as ChatAPI from "@core/camp/api/UnifiedChatAPI";
import RetroSpinner from "@ui/components/ui/retro-spinner";

/**
 * Private Chats Page - Full page view of all private forks
 *
 * Shows all private forks (private replies to team chats) in chronological order,
 * with search capability.
 */

interface PrivateFork {
    id: string;
    title: string;
    parentChat?: {
        id: string;
        title?: string;
        isDeleted?: boolean;
    };
    updatedAt: number;
}

interface GroupedContent {
    label: string;
    items: PrivateFork[];
}

function isToday(date: Date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

function isYesterday(date: Date) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
}

function isLastWeek(date: Date) {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    return date >= lastWeek && date < today;
}

export function PrivateChatsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    // Fetch all private forks
    const privateForksQuery = ChatAPI.usePrivateForksQuery();
    const privateForks = useMemo(
        () =>
            (privateForksQuery.data ?? []).map((fork) => ({
                id: fork.id,
                title: "",
                parentChat: fork.parentChat,
                updatedAt: new Date(fork.updatedAt).getTime(),
            })),
        [privateForksQuery.data],
    );

    // Filter private forks by search query
    const filteredForks = useMemo(() => {
        if (!searchQuery.trim()) {
            return privateForks;
        }

        const query = searchQuery.toLowerCase();
        return privateForks.filter((fork) => {
            const displayTitle =
                fork.parentChat?.title || fork.title || "Untitled";
            return displayTitle.toLowerCase().includes(query);
        });
    }, [privateForks, searchQuery]);

    // Sort by updatedAt descending
    const sortedForks = useMemo(
        () =>
            filteredForks.sort((a, b) => {
                return b.updatedAt - a.updatedAt;
            }),
        [filteredForks],
    );

    // Group by date
    const groupedForks = useMemo(() => {
        const groups: GroupedContent[] = [];
        const today: PrivateFork[] = [];
        const yesterday: PrivateFork[] = [];
        const lastWeek: PrivateFork[] = [];
        const older: PrivateFork[] = [];

        sortedForks.forEach((fork) => {
            const date = new Date(fork.updatedAt);

            if (isToday(date)) {
                today.push(fork);
            } else if (isYesterday(date)) {
                yesterday.push(fork);
            } else if (isLastWeek(date)) {
                lastWeek.push(fork);
            } else {
                older.push(fork);
            }
        });

        if (today.length) groups.push({ label: "Today", items: today });
        if (yesterday.length)
            groups.push({ label: "Yesterday", items: yesterday });
        if (lastWeek.length)
            groups.push({ label: "Last Week", items: lastWeek });
        if (older.length) groups.push({ label: "Older", items: older });

        return groups;
    }, [sortedForks]);

    if (privateForksQuery.isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <RetroSpinner />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
                    <LockIcon className="size-6" strokeWidth={1.5} />
                    Private Chats
                </h1>
                <p className="text-muted-foreground text-sm">
                    {privateForks.length} private fork
                    {privateForks.length !== 1 ? "s" : ""}
                </p>
            </div>

            {/* Search bar */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search private chats..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                        autoFocus
                    />
                </div>
            </div>

            {/* List grouped by date */}
            <div className="flex-1 overflow-y-auto">
                {groupedForks.length > 0 ? (
                    groupedForks.map(({ label, items }) => (
                        <div key={label} className="mb-6">
                            <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                {label}
                                <span className="text-xs opacity-60">
                                    {items.length}
                                </span>
                            </h2>
                            <div className="space-y-1">
                                {items.map((fork) => {
                                    const isActive = currentPath.includes(
                                        `/chat/${fork.id}`,
                                    );
                                    const displayTitle =
                                        fork.parentChat?.title ||
                                        fork.title ||
                                        "Untitled";
                                    const isParentDeleted =
                                        fork.parentChat?.isDeleted ?? false;

                                    return (
                                        <button
                                            key={fork.id}
                                            onClick={() =>
                                                navigate(`/chat/${fork.id}`)
                                            }
                                            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                                                isActive
                                                    ? "bg-accent text-accent-foreground"
                                                    : "hover:bg-muted"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <LockIcon
                                                    className="size-4 flex-shrink-0 text-muted-foreground"
                                                    strokeWidth={1.5}
                                                />
                                                <span
                                                    className={`text-sm font-medium truncate ${isParentDeleted ? "text-muted-foreground" : ""}`}
                                                >
                                                    {displayTitle}
                                                </span>
                                                {isParentDeleted && (
                                                    <span className="text-xs text-muted-foreground">
                                                        (Deleted)
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        {searchQuery
                            ? "No private chats match your search"
                            : "No private chats yet"}
                    </div>
                )}
            </div>
        </div>
    );
}
