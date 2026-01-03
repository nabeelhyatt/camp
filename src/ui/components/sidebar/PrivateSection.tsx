import React from "react";
import {
    LockIcon,
    ChevronRightIcon,
    FolderPlusIcon,
    ReplyIcon,
    Trash2Icon,
} from "lucide-react";
import {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@ui/components/ui/sidebar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@ui/components/ui/tooltip";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Private Section - Shows user's private projects and forks
 *
 * Phase 1: Greyed out placeholder ("Coming soon")
 * Phase 2: Activated for private forks only
 * Phase 4: Full activation with private projects
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

interface PrivateSectionProps {
    enabled?: boolean;
    privateForks?: PrivateFork[];
    onCreatePrivateProject?: () => void;
    children?: React.ReactNode;
}

export function PrivateSection({
    enabled = false,
    privateForks = [],
    onCreatePrivateProject,
    children,
}: PrivateSectionProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = location.pathname === "/private-chats";

    if (!enabled) {
        return <PrivateSectionPlaceholder />;
    }

    const hasForks = privateForks.length > 0;
    const hasChildren = React.Children.count(children) > 0;

    return (
        <div className="mb-4">
            {/* Section Header - Clickable to navigate to full Private Chats view */}
            <div className="pt-2 flex items-center justify-between group/section">
                <button
                    onClick={() => navigate("/private-chats")}
                    className={`sidebar-label flex w-full items-center gap-2 px-3 py-2 text-muted-foreground rounded-md transition-colors cursor-pointer ${
                        isActive
                            ? "bg-muted/50 text-foreground"
                            : "bg-muted/30 hover:bg-muted/40"
                    }`}
                >
                    <LockIcon className="size-3.5" strokeWidth={1.5} />
                    Private
                </button>
                {onCreatePrivateProject && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                className="text-muted-foreground hover:text-foreground p-1 pr-3 rounded opacity-0 group-hover/section:opacity-100 transition-opacity"
                                onClick={onCreatePrivateProject}
                            >
                                <FolderPlusIcon
                                    className="size-3.5"
                                    strokeWidth={1.5}
                                />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>New Private Project</TooltipContent>
                    </Tooltip>
                )}
            </div>

            {/* Section Content */}
            <SidebarMenu className="truncate">
                {/* Private Forks */}
                {hasForks && (
                    <div className="mb-2">
                        {privateForks.map((fork) => (
                            <PrivateForkItem key={fork.id} fork={fork} />
                        ))}
                    </div>
                )}

                {/* Other private content */}
                {children}

                {/* Empty state */}
                {!hasForks && !hasChildren && <PrivateSectionEmpty />}
            </SidebarMenu>
        </div>
    );
}

/**
 * Individual private fork item in the sidebar
 *
 * Shows: [Lock icon] [Reply icon] [Parent chat title]
 * If parent is deleted: [Lock icon] [Reply icon] [Trash icon] [Title]
 * This makes it clear that this is a private reply to a specific chat
 */
function PrivateForkItem({ fork }: { fork: PrivateFork }) {
    const navigate = useNavigate();

    // Use parent chat title if available, otherwise fall back to fork title
    const displayTitle = fork.parentChat?.title || fork.title || "Untitled";
    const isParentDeleted = fork.parentChat?.isDeleted ?? false;

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                onClick={() => navigate(`/chat/${fork.id}`)}
                className="group/fork flex items-center justify-between"
            >
                <span className="flex items-center gap-1.5 truncate">
                    {/* Lock + Reply icons to indicate private reply */}
                    <span className="flex items-center flex-shrink-0">
                        <LockIcon
                            className="size-3 text-muted-foreground"
                            strokeWidth={1.5}
                        />
                        <ReplyIcon
                            className="size-3 text-muted-foreground -ml-0.5"
                            strokeWidth={1.5}
                        />
                    </span>
                    {/* Show deleted indicator if parent was deleted */}
                    {isParentDeleted && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Trash2Icon
                                    className="size-3 text-muted-foreground/50 flex-shrink-0"
                                    strokeWidth={1.5}
                                />
                            </TooltipTrigger>
                            <TooltipContent>
                                Parent chat was deleted
                            </TooltipContent>
                        </Tooltip>
                    )}
                    <span
                        className={`truncate text-sm ${isParentDeleted ? "text-muted-foreground" : ""}`}
                    >
                        {displayTitle}
                    </span>
                </span>

                {/* Go to parent chat button (on hover) - only if parent not deleted */}
                {fork.parentChat && !isParentDeleted && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/chat/${fork.parentChat!.id}`);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.stopPropagation();
                                        navigate(
                                            `/chat/${fork.parentChat!.id}`,
                                        );
                                    }
                                }}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover/fork:opacity-100 transition-opacity cursor-pointer"
                            >
                                <ChevronRightIcon className="size-3" />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            Go to parent: {fork.parentChat.title || "Untitled"}
                        </TooltipContent>
                    </Tooltip>
                )}
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

/**
 * Placeholder shown when Private section is not yet enabled
 */
function PrivateSectionPlaceholder() {
    return (
        <div className="mb-4 opacity-50 cursor-not-allowed">
            {/* Section Header */}
            <div className="pt-2 flex items-center justify-between">
                <div className="sidebar-label flex w-full items-center gap-2 px-3 text-muted-foreground">
                    <LockIcon className="size-3.5" strokeWidth={1.5} />
                    Private
                </div>
                <div className="pr-3">
                    <LockIcon className="size-3 text-muted-foreground/50" />
                </div>
            </div>

            {/* Placeholder Content */}
            <div className="px-3 py-2">
                <p className="text-xs text-muted-foreground/60 italic">
                    Coming soon
                </p>
            </div>
        </div>
    );
}

/**
 * Empty state when Private section is enabled but has no content
 */
export function PrivateSectionEmpty() {
    return (
        <div className="px-3 text-base text-muted-foreground border rounded-md p-2 mt-1 border-muted-foreground/10">
            <p className="text-sm whitespace-normal break-words">
                Your private explorations will appear here.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
                Reply privately to any team message to start exploring.
            </p>
        </div>
    );
}
