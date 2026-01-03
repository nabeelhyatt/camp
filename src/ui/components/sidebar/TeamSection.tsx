import { PlusIcon, GlobeIcon, FolderPlusIcon } from "lucide-react";
import {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@ui/components/ui/sidebar";
import { useCurrentUser } from "@core/camp/auth/useCurrentUser";
import { useNavigate, useLocation } from "react-router-dom";

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

/**
 * Favicon component that loads domain favicon with fallback to GlobeIcon
 */
function DomainIcon({
    domain,
    className,
}: {
    domain: string | undefined;
    className?: string;
}) {
    // For personal domains or missing domain, use globe icon
    if (!domain || domain.startsWith("personal-")) {
        return <GlobeIcon className={className} strokeWidth={1.5} />;
    }

    // Use Google's favicon service
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

    return (
        <img
            src={faviconUrl}
            alt=""
            className={className}
            onError={(e) => {
                // Hide image on error, parent should have fallback styling
                e.currentTarget.style.display = "none";
            }}
        />
    );
}

export function TeamSection({ onCreateProject, children }: TeamSectionProps) {
    const { organization } = useCurrentUser();
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = location.pathname === "/team-projects";

    return (
        <div className="mb-4">
            {/* Section Header - Clickable to navigate to full Team Projects view */}
            <div className="pt-2 flex items-center justify-between">
                <button
                    onClick={() => navigate("/team-projects")}
                    className={`sidebar-label flex w-full items-center gap-2 px-3 py-2 text-muted-foreground rounded-md transition-colors cursor-pointer ${
                        isActive
                            ? "bg-muted/50 text-foreground"
                            : "bg-muted/30 hover:bg-muted/40"
                    }`}
                >
                    <DomainIcon
                        domain={organization?.domain}
                        className="size-3.5"
                    />
                    Team Projects
                </button>
            </div>

            {/* Section Content */}
            <div className="truncate">
                {/* New Project button at top */}
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={onCreateProject}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <PlusIcon className="size-4" strokeWidth={1.5} />
                            <span className="text-base">New project</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>

                {children}
            </div>
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
