import { ShareIcon, LockIcon } from "lucide-react";
import { SidebarMenu } from "@ui/components/ui/sidebar";

/**
 * Shared Section - Shows projects shared with specific people
 *
 * Phase 1: Greyed out placeholder ("Coming soon")
 * Phase 4: Activated with full functionality
 */

interface SharedSectionProps {
    enabled?: boolean;
    children?: React.ReactNode;
}

export function SharedSection({
    enabled = false,
    children,
}: SharedSectionProps) {
    if (!enabled) {
        return <SharedSectionPlaceholder />;
    }

    return (
        <div className="mb-4">
            {/* Section Header */}
            <div className="pt-2 flex items-center justify-between group/section">
                <div className="sidebar-label flex w-full items-center gap-2 px-3 text-muted-foreground">
                    <ShareIcon className="size-3.5" strokeWidth={1.5} />
                    Shared
                </div>
            </div>

            {/* Section Content */}
            <SidebarMenu className="truncate">{children}</SidebarMenu>
        </div>
    );
}

/**
 * Placeholder shown when Shared section is not yet enabled
 */
function SharedSectionPlaceholder() {
    return (
        <div className="mb-4 opacity-50 cursor-not-allowed">
            {/* Section Header */}
            <div className="pt-2 flex items-center justify-between">
                <div className="sidebar-label flex w-full items-center gap-2 px-3 text-muted-foreground">
                    <ShareIcon className="size-3.5" strokeWidth={1.5} />
                    Shared
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
 * Empty state when Shared section is enabled but has no content
 */
export function SharedSectionEmpty() {
    return (
        <div className="px-3 text-base text-muted-foreground border rounded-md p-2 mt-1 border-muted-foreground/10">
            <p className="text-sm whitespace-normal break-words">
                Projects shared with you will appear here.
            </p>
        </div>
    );
}
