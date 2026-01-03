import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SearchIcon, MessageSquareIcon } from "lucide-react";
import { type Chat } from "@core/camp/api/UnifiedChatAPI";
import { type Project } from "@core/camp/api/UnifiedProjectAPI";
import * as ChatAPI from "@core/camp/api/UnifiedChatAPI";
import * as ProjectAPI from "@core/camp/api/UnifiedProjectAPI";
import { projectDisplayName } from "@ui/lib/utils";
import RetroSpinner from "@ui/components/ui/retro-spinner";

/**
 * All Chats Page - Full page view of all ungrouped chats
 *
 * Shows chats grouped by date (Today, Yesterday, Last Week, Older)
 * with search/filter capability and project attribution.
 * Similar to Conductor's workspace list view.
 */

interface GroupedChats {
    label: string;
    chats: Chat[];
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
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Last week: between 7 days ago and yesterday (not including today/yesterday)
    return d >= lastWeek && d < yesterday;
}

function groupChatsByDate(chats: Chat[]): GroupedChats[] {
    const groups: GroupedChats[] = [];

    const today: Chat[] = [];
    const yesterday: Chat[] = [];
    const lastWeek: Chat[] = [];
    const older: Chat[] = [];

    chats.forEach((chat) => {
        // toDateString() already reflects local time, no offset needed
        const date = new Date(chat.updatedAt || 0);

        if (isToday(date)) {
            today.push(chat);
        } else if (isYesterday(date)) {
            yesterday.push(chat);
        } else if (isLastWeek(date)) {
            lastWeek.push(chat);
        } else {
            older.push(chat);
        }
    });

    if (today.length) groups.push({ label: "Today", chats: today });
    if (yesterday.length) groups.push({ label: "Yesterday", chats: yesterday });
    if (lastWeek.length) groups.push({ label: "Last Week", chats: lastWeek });
    if (older.length) groups.push({ label: "Older", chats: older });

    return groups;
}

export function AllChatsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const currentChatId = location.pathname.split("/").pop() ?? "";

    // Fetch all chats (ungrouped - those in "default" project)
    const chatsQuery = ChatAPI.useChatsQuery({ projectId: "default" });
    const projectsQuery = ProjectAPI.useProjectsQuery();

    const chats = chatsQuery.data ?? [];
    const projects = projectsQuery.data ?? [];

    // Create project lookup map
    const projectMap = useMemo(() => {
        const map = new Map<string, Project>();
        projects.forEach((p) => map.set(p.id, p));
        return map;
    }, [projects]);

    // Filter chats by search query
    const filteredChats = useMemo(() => {
        // Filter out new chats and quick chats for this view
        const displayableChats = chats.filter(
            (chat) => !chat.isNewChat && !chat.quickChat,
        );

        if (!searchQuery.trim()) return displayableChats;

        const query = searchQuery.toLowerCase();
        return displayableChats.filter((chat) => {
            const title = (chat.title || "Untitled Chat").toLowerCase();
            const project = projectMap.get(chat.projectId);
            const projectName = project
                ? projectDisplayName(project.name).toLowerCase()
                : "";
            return title.includes(query) || projectName.includes(query);
        });
    }, [chats, searchQuery, projectMap]);

    // Group filtered chats by date
    const groupedChats = useMemo(
        () => groupChatsByDate(filteredChats),
        [filteredChats],
    );

    if (chatsQuery.isLoading || projectsQuery.isLoading) {
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
                    <MessageSquareIcon className="size-6" strokeWidth={1.5} />
                    All Chats
                </h1>
                <p className="text-muted-foreground text-sm">
                    {filteredChats.length} chat
                    {filteredChats.length !== 1 ? "s" : ""}
                </p>
            </div>

            {/* Search bar */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Filter chats..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                        autoFocus
                    />
                </div>
            </div>

            {/* Chat list grouped by date */}
            <div className="flex-1 overflow-y-auto">
                {groupedChats.length > 0 ? (
                    groupedChats.map(({ label, chats: groupChats }) => (
                        <div key={label} className="mb-6">
                            <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                {label}
                                <span className="text-xs opacity-60">
                                    {groupChats.length}
                                </span>
                            </h2>
                            <div className="space-y-1">
                                {groupChats.map((chat) => {
                                    const project = projectMap.get(
                                        chat.projectId,
                                    );
                                    const isActive = currentChatId === chat.id;

                                    return (
                                        <button
                                            key={chat.id}
                                            onClick={() =>
                                                navigate(`/chat/${chat.id}`)
                                            }
                                            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                                                isActive
                                                    ? "bg-accent text-accent-foreground"
                                                    : "hover:bg-muted"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium truncate">
                                                    {chat.title ||
                                                        "Untitled Chat"}
                                                </span>
                                            </div>
                                            {project &&
                                                project.id !== "default" && (
                                                    <span className="text-xs text-muted-foreground truncate block mt-0.5">
                                                        {projectDisplayName(
                                                            project.name,
                                                        )}
                                                    </span>
                                                )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        {searchQuery
                            ? "No chats match your search"
                            : "No ungrouped chats yet"}
                    </div>
                )}
            </div>
        </div>
    );
}
