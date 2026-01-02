import { ChevronDownIcon, ListIcon, SearchIcon } from "lucide-react";
import {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@ui/components/ui/sidebar";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@ui/components/ui/collapsible";
import { useState, useMemo } from "react";
import { type Chat } from "@core/camp/api/UnifiedChatAPI";
import { type Project } from "@core/camp/api/UnifiedProjectAPI";
import { useNavigate, useLocation } from "react-router-dom";
import { projectDisplayName } from "@ui/lib/utils";

/**
 * All Chats Section - Shows all ungrouped chats in a feed view
 *
 * Displays chats grouped by date (Today, Yesterday, Last Week, Older)
 * with search/filter capability and project attribution.
 */

interface AllChatsSectionProps {
    chats: Chat[];
    projects: Project[];
}

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
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    return date >= lastWeek && date < today;
}

function groupChatsByDate(chats: Chat[]): GroupedChats[] {
    const groups: GroupedChats[] = [];

    const today: Chat[] = [];
    const yesterday: Chat[] = [];
    const lastWeek: Chat[] = [];
    const older: Chat[] = [];

    chats.forEach((chat) => {
        const utcDate = new Date(chat.updatedAt || 0);
        // Convert to local time
        const date = new Date(
            utcDate.getTime() - utcDate.getTimezoneOffset() * 60000,
        );

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

export function AllChatsSection({ chats, projects }: AllChatsSectionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const currentChatId = location.pathname.split("/").pop() ?? "";

    // Create project lookup map
    const projectMap = useMemo(() => {
        const map = new Map<string, Project>();
        projects.forEach((p) => map.set(p.id, p));
        return map;
    }, [projects]);

    // Filter chats by search query
    const filteredChats = useMemo(() => {
        if (!searchQuery.trim()) return chats;

        const query = searchQuery.toLowerCase();
        return chats.filter((chat) => {
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

    const totalCount = chats.length;

    return (
        <div className="mt-2">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                    <button className="w-full pt-2 flex items-center justify-between group/section px-3">
                        <div className="sidebar-label flex items-center gap-2 text-muted-foreground">
                            <ListIcon className="size-3.5" strokeWidth={1.5} />
                            All Chats
                            <span className="text-xs">({totalCount})</span>
                        </div>
                        <ChevronDownIcon
                            className={`size-3.5 text-muted-foreground transition-transform ${
                                isOpen ? "" : "-rotate-90"
                            }`}
                            strokeWidth={1.5}
                        />
                    </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    {/* Search/Filter bar */}
                    <div className="px-3 py-2">
                        <div className="relative">
                            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Filter chats..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-7 pr-3 py-1.5 text-sm bg-sidebar-accent/50 border border-sidebar-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>

                    {/* Chat list grouped by date */}
                    <SidebarMenu className="max-h-[400px] overflow-y-auto no-scrollbar">
                        {groupedChats.length > 0 ? (
                            groupedChats.map(({ label, chats: groupChats }) => (
                                <div key={label} className="pb-2">
                                    <div className="px-3 mb-1 sidebar-label flex items-center gap-2 text-muted-foreground text-xs">
                                        {label}
                                        <span className="text-xs opacity-60">
                                            ({groupChats.length})
                                        </span>
                                    </div>
                                    {groupChats.map((chat) => {
                                        const project = projectMap.get(
                                            chat.projectId,
                                        );
                                        const isActive =
                                            currentChatId === chat.id;

                                        return (
                                            <SidebarMenuItem key={chat.id}>
                                                <SidebarMenuButton
                                                    onClick={() =>
                                                        navigate(
                                                            `/chat/${chat.id}`,
                                                        )
                                                    }
                                                    isActive={isActive}
                                                    className="flex flex-col items-start gap-0.5 h-auto py-1.5"
                                                >
                                                    <span className="text-sm truncate w-full">
                                                        {chat.title ||
                                                            "Untitled Chat"}
                                                    </span>
                                                    {project &&
                                                        project.id !==
                                                            "default" && (
                                                            <span className="text-xs text-muted-foreground truncate w-full">
                                                                {projectDisplayName(
                                                                    project.name,
                                                                )}
                                                            </span>
                                                        )}
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        );
                                    })}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                {searchQuery
                                    ? "No chats match your search"
                                    : "No chats yet"}
                            </div>
                        )}
                    </SidebarMenu>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
