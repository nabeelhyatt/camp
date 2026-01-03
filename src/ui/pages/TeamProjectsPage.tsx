import { useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    SearchIcon,
    FolderIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
} from "lucide-react";
import { type ChatWithCreator, type Chat } from "@core/camp/api/UnifiedChatAPI";
import {
    type ProjectWithCreator,
    type Project,
} from "@core/camp/api/UnifiedProjectAPI";
import * as ChatAPI from "@core/camp/api/UnifiedChatAPI";
import * as ProjectAPI from "@core/camp/api/UnifiedProjectAPI";
import { projectDisplayName } from "@ui/lib/utils";
import RetroSpinner from "@ui/components/ui/retro-spinner";
import { Button } from "@ui/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@ui/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@ui/components/ui/avatar";
import { useSidebar } from "@ui/hooks/useSidebar";
import { SidebarTrigger } from "@ui/components/ui/sidebar";

/**
 * Team Projects Page - Full page view of all team projects and chats
 *
 * Shows all team projects with their chats in chronological order,
 * with search/filter capability and user attribution.
 */

type ItemWithCreator = ProjectWithCreator | ChatWithCreator;

interface GroupedContent {
    label: string;
    items: ItemWithCreator[];
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

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

export function TeamProjectsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;
    const { open: isSidebarOpen } = useSidebar();

    // Navigation handlers
    const canGoForward = useMemo(() => {
        const { state } = window.history as { state: { idx: number } };
        return state && state.idx < window.history.length - 1;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]);

    const handleForwardNavigation = useCallback(() => {
        navigate(1);
    }, [navigate]);

    const handleBackNavigation = useCallback(() => {
        navigate(-1);
    }, [navigate]);

    // Fetch all team projects and chats with creators
    const projectsQuery = ProjectAPI.useProjectsWithCreatorsQuery();
    const chatsQuery = ChatAPI.useChatsWithCreatorsQuery();

    const projects = projectsQuery.data ?? [];
    const chats = chatsQuery.data ?? [];

    // Filter team projects (exclude default/quick-chat)
    const teamProjects = useMemo(
        () =>
            projects.filter((p) => p.id !== "default" && p.id !== "quick-chat"),
        [projects],
    );

    // Filter and combine projects and chats for display
    // Filter out quickChat, isNewChat (untouched chats), and chats with no real title
    const filteredItems = useMemo(() => {
        // Filter chats: exclude quick chats, new chats, and only show team-visible
        const teamChats = chats.filter(
            (c) => !c.quickChat && !c.isNewChat && c.title !== "New Chat",
        );

        if (!searchQuery.trim()) {
            // Show all team projects and their chats
            return [...teamProjects, ...teamChats] as ItemWithCreator[];
        }

        const query = searchQuery.toLowerCase();
        const matchingProjects = teamProjects.filter((p) =>
            projectDisplayName(p.name).toLowerCase().includes(query),
        );
        const matchingChats = teamChats.filter((c) => {
            const title = (c.title || "Untitled Chat").toLowerCase();
            return title.includes(query);
        });

        return [...matchingProjects, ...matchingChats] as ItemWithCreator[];
    }, [teamProjects, chats, searchQuery]);

    // Sort by updatedAt descending (create copy to avoid mutating memoized array)
    const sortedItems = useMemo(
        () =>
            [...filteredItems].sort((a, b) => {
                const aTime = new Date(a.updatedAt).getTime();
                const bTime = new Date(b.updatedAt).getTime();
                return bTime - aTime;
            }),
        [filteredItems],
    );

    // Group by date
    const groupedItems = useMemo(() => {
        const groups: GroupedContent[] = [];
        const today: ItemWithCreator[] = [];
        const yesterday: ItemWithCreator[] = [];
        const lastWeek: ItemWithCreator[] = [];
        const older: ItemWithCreator[] = [];

        sortedItems.forEach((item) => {
            // toDateString() already reflects local time, no offset needed
            const date = new Date(item.updatedAt);

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

        if (today.length) groups.push({ label: "Today", items: today });
        if (yesterday.length)
            groups.push({ label: "Yesterday", items: yesterday });
        if (lastWeek.length)
            groups.push({ label: "Last Week", items: lastWeek });
        if (older.length) groups.push({ label: "Older", items: older });

        return groups;
    }, [sortedItems]);

    if (projectsQuery.isLoading || chatsQuery.isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <RetroSpinner />
            </div>
        );
    }

    const isProject = (item: ItemWithCreator): item is ProjectWithCreator => {
        return "name" in item;
    };

    // Count actual team chats (excluding new/quick)
    const teamChatCount = chats.filter(
        (c) => !c.quickChat && !c.isNewChat && c.title !== "New Chat",
    ).length;

    return (
        <div className="flex flex-col h-full">
            {/* Header Bar */}
            <div
                data-tauri-drag-region
                className={`sticky top-0 ${isSidebarOpen ? "" : "pl-20"} h-[52px] z-10 items-center justify-between px-3 flex bg-background border-b`}
            >
                <div className="flex items-center gap-1">
                    {!isSidebarOpen && (
                        <SidebarTrigger className="!size-4 ml-2" />
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="link"
                                size="iconSm"
                                onClick={handleBackNavigation}
                            >
                                <ArrowLeftIcon
                                    strokeWidth={1.5}
                                    className="!size-3.5 ml-2"
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            Back{" "}
                            <kbd>
                                <span>⌘</span>[
                            </kbd>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="link"
                                size="iconSm"
                                onClick={handleForwardNavigation}
                                disabled={!canGoForward}
                                className={
                                    !canGoForward
                                        ? "text-helper"
                                        : "text-accent-foreground"
                                }
                            >
                                <ArrowRightIcon
                                    strokeWidth={1.5}
                                    className="!size-3.5"
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            Forward{" "}
                            <kbd>
                                <span>⌘</span>]
                            </kbd>
                        </TooltipContent>
                    </Tooltip>

                    {/* Breadcrumb */}
                    <div className="flex items-center ml-1 text-sidebar-muted-foreground">
                        <FolderIcon
                            strokeWidth={1.5}
                            className="!size-3.5 mr-1"
                        />
                        <span className="text-sm text-sidebar-foreground">
                            Team Projects
                        </span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-6 py-8">
                    {/* Page Header */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
                            <FolderIcon className="size-6" strokeWidth={1.5} />
                            Team Projects
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            {teamProjects.length} project
                            {teamProjects.length !== 1 ? "s" : ""}
                            {" • "}
                            {teamChatCount} chat
                            {teamChatCount !== 1 ? "s" : ""}
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
                    <div>
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
                                                    <div className="flex items-center gap-3">
                                                        {/* Creator Avatar */}
                                                        <Avatar className="size-6">
                                                            {item.creator
                                                                ?.avatarUrl ? (
                                                                <AvatarImage
                                                                    src={
                                                                        item
                                                                            .creator
                                                                            .avatarUrl
                                                                    }
                                                                    alt={
                                                                        item
                                                                            .creator
                                                                            .displayName
                                                                    }
                                                                />
                                                            ) : null}
                                                            <AvatarFallback className="text-xs">
                                                                {item.creator
                                                                    ?.displayName
                                                                    ? getInitials(
                                                                          item
                                                                              .creator
                                                                              .displayName,
                                                                      )
                                                                    : "?"}
                                                            </AvatarFallback>
                                                        </Avatar>

                                                        {/* Icon + Title */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                {isProj && (
                                                                    <FolderIcon
                                                                        className="size-4 flex-shrink-0 text-muted-foreground"
                                                                        strokeWidth={
                                                                            1.5
                                                                        }
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
                                                            {/* Show project name for chats */}
                                                            {!isProj &&
                                                                (item as Chat)
                                                                    .projectId &&
                                                                (item as Chat)
                                                                    .projectId !==
                                                                    "default" && (
                                                                    <span className="text-xs text-muted-foreground truncate block mt-0.5">
                                                                        {projectDisplayName(
                                                                            (
                                                                                projects as Project[]
                                                                            ).find(
                                                                                (
                                                                                    p,
                                                                                ) =>
                                                                                    p.id ===
                                                                                    (
                                                                                        item as Chat
                                                                                    )
                                                                                        .projectId,
                                                                            )
                                                                                ?.name ||
                                                                                "",
                                                                        )}
                                                                    </span>
                                                                )}
                                                        </div>
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
                                    ? "No items match your search"
                                    : "No team projects yet"}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
