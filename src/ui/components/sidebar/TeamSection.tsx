import { FolderPlusIcon, UsersIcon } from "lucide-react";
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

/**
 * Team Section - Shows team projects and chats
 *
 * This is the primary section in the multiplayer sidebar.
 * Displays content visible to all workspace members.
 *
 * Phase 1: Functional - shows actual team content
 */

interface TeamSectionProps {
    onCreateProject: () => void;
    children: React.ReactNode;
}

export function TeamSection({ onCreateProject, children }: TeamSectionProps) {
    return (
        <div className="mb-4">
            {/* Section Header */}
            <div className="pt-2 flex items-center justify-between group/section">
                <div className="sidebar-label flex w-full items-center gap-2 px-3 text-muted-foreground">
                    <UsersIcon className="size-3.5" strokeWidth={1.5} />
                    Team
                </div>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            className="text-muted-foreground hover:text-foreground p-1 pr-3 rounded opacity-0 group-hover/section:opacity-100 transition-opacity"
                            onClick={onCreateProject}
                        >
                            <FolderPlusIcon
                                className="size-3.5"
                                strokeWidth={1.5}
                            />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>New Team Project</TooltipContent>
                </Tooltip>
            </div>

            {/* Section Content */}
            <SidebarMenu className="truncate">{children}</SidebarMenu>
        </div>
    );
}

/**
 * Empty state when team has no projects
 */
export function TeamSectionEmpty({
    onCreateProject,
}: {
    onCreateProject: () => void;
}) {
    return (
        <div className="px-3 text-base text-muted-foreground border rounded-md p-2 mt-1 border-muted-foreground/10">
            <p className="mb-2 text-sm whitespace-normal break-words">
                Team projects are visible to everyone on your team.
            </p>
            <button
                className="text-foreground hover:underline text-sm flex items-center gap-1"
                onClick={onCreateProject}
            >
                <FolderPlusIcon className="size-3.5" strokeWidth={1.5} />
                Create a team project
            </button>
        </div>
    );
}
