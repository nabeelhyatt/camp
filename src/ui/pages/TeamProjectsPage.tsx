import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SearchIcon, FolderIcon } from "lucide-react";
import { type Chat } from "@core/camp/api/UnifiedChatAPI";
import { type Project } from "@core/camp/api/UnifiedProjectAPI";
import * as ChatAPI from "@core/camp/api/UnifiedChatAPI";
import * as ProjectAPI from "@core/camp/api/UnifiedProjectAPI";
import { projectDisplayName } from "@ui/lib/utils";
import RetroSpinner from "@ui/components/ui/retro-spinner";

/**
 * Team Projects Page - Full page view of all team projects and chats
 *
 * Shows all team projects with their chats in chronological order,
 * with search/filter capability and user attribution.
 */

interface GroupedContent {
    label: string;
    items: (Project | Chat)[];
    type: "project" | "chat";
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

export function TeamProjectsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    // Fetch all team projects and chats
    const projectsQuery = ProjectAPI.useProjectsQuery();
    const chatsQuery = ChatAPI.useChatsQuery();

    const projects = projectsQuery.data ?? [];
    const chats = chatsQuery.data ?? [];

    // Filter team projects (exclude default/quick-chat)
    const teamProjects = useMemo(
        () =>
            projects.filter((p) => p.id !== "default" && p.id !== "quick-chat"),
        [projects],
    );

    // Filter and combine projects and chats for display
    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) {
            // Show all team projects and their chats
            return [
                ...teamProjects,
                ...chats.filter((c) => !c.quickChat && !c.isNewChat),
            ];
        }

        const query = searchQuery.toLowerCase();
        const matchingProjects = teamProjects.filter((p) =>
            projectDisplayName(p.name).toLowerCase().includes(query),
        );
        const matchingChats = chats.filter((c) => {
            const title = (c.title || "Untitled Chat").toLowerCase();
            return title.includes(query);
        });

        return [...matchingProjects, ...matchingChats];
    }, [teamProjects, chats, searchQuery]);

    // Sort by updatedAt descending
    const sortedItems = useMemo(
        () =>
            filteredItems.sort((a, b) => {
                const aTime = new Date(a.updatedAt).getTime();
                const bTime = new Date(b.updatedAt).getTime();
                return bTime - aTime;
            }),
        [filteredItems],
    );

    // Group by date
    const groupedItems = useMemo(() => {
        const groups: GroupedContent[] = [];
        const today: (Project | Chat)[] = [];
        const yesterday: (Project | Chat)[] = [];
        const lastWeek: (Project | Chat)[] = [];
        const older: (Project | Chat)[] = [];

        sortedItems.forEach((item) => {
            const utcDate = new Date(item.updatedAt);
            const date = new Date(
                utcDate.getTime() - utcDate.getTimezoneOffset() * 60000,
            );

            if (isToday(date)) {
                today.push(item);
            } else if (isYesterday(date)) {
                yesterday.push(item);
            } else if (isLastWeek(date)) {
                lastWeek.push(item);
            } else {
                older.push(item);
            }
        });

        if (today.length)
            groups.push({ label: "Today", items: today, type: "project" });
        if (yesterday.length)
            groups.push({
                label: "Yesterday",
                items: yesterday,
                type: "project",
            });
        if (lastWeek.length)
            groups.push({
                label: "Last Week",
                items: lastWeek,
                type: "project",
            });
        if (older.length)
            groups.push({ label: "Older", items: older, type: "project" });

        return groups;
    }, [sortedItems]);

    if (projectsQuery.isLoading || chatsQuery.isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <RetroSpinner />
            </div>
        );
    }

    const isProject = (item: Project | Chat): item is Project => {
        return "name" in item;
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
                    <FolderIcon className="size-6" strokeWidth={1.5} />
                    Team Projects
                </h1>
                <p className="text-muted-foreground text-sm">
                    {teamProjects.length} project
                    {teamProjects.length !== 1 ? "s" : ""}
                    {" • "}
                    {filteredItems.length} total item
                    {filteredItems.length !== 1 ? "s" : ""}
                </p>
            </div>

            {/* Search bar */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search projects and chats..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                        autoFocus
                    />
                </div>
            </div>

            {/* List grouped by date */}
            <div className="flex-1 overflow-y-auto">
                {groupedItems.length > 0 ? (
                    groupedItems.map(({ label, items }) => (
                        <div key={label} className="mb-6">
                            <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                {label}
                                <span className="text-xs opacity-60">
                                    {items.length}
                                </span>
                            </h2>
                            <div className="space-y-1">
                                {items.map((item) => {
                                    const isProj = isProject(item);
                                    const isActive = isProj
                                        ? currentPath.includes(
                                              `/projects/${item.id}`,
                                          )
                                        : currentPath.includes(
                                              `/chat/${item.id}`,
                                          );

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() =>
                                                navigate(
                                                    isProj
                                                        ? `/projects/${item.id}`
                                                        : `/chat/${item.id}`,
                                                )
                                            }
                                            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                                                isActive
                                                    ? "bg-accent text-accent-foreground"
                                                    : "hover:bg-muted"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isProj && (
                                                    <FolderIcon
                                                        className="size-4 flex-shrink-0 text-muted-foreground"
                                                        strokeWidth={1.5}
                                                    />
                                                )}
                                                <span className="text-sm font-medium truncate">
                                                    {isProj
                                                        ? projectDisplayName(
                                                              item.name,
                                                          )
                                                        : item.title ||
                                                          "Untitled Chat"}
                                                </span>
                                            </div>
                                            {!isProj && item.projectId && (
                                                <span className="text-xs text-muted-foreground truncate block mt-0.5 ml-6">
                                                    {projectDisplayName(
                                                        projects.find(
                                                            (p) =>
                                                                p.id ===
                                                                item.projectId,
                                                        )?.name || "",
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
                            ? "No items match your search"
                            : "No team projects yet"}
                    </div>
                )}
            </div>
        </div>
    );
}
