import { useState } from "react";
import { Switch } from "./switch";
import { LockIcon, GlobeIcon } from "lucide-react";
import { useCurrentUser } from "@core/camp/auth/useCurrentUser";
import { cn } from "@ui/lib/utils";

interface PrivateTeamToggleProps {
    isTeam: boolean;
    onToggle: (isTeam: boolean) => void;
    disabled?: boolean;
    className?: string;
}

/**
 * Favicon component that loads domain favicon with fallback to GlobeIcon
 */
function OrgIcon({
    domain,
    className,
}: {
    domain: string | undefined;
    className?: string;
}) {
    const [hasError, setHasError] = useState(false);

    // For personal domains, missing domain, or load errors, use globe icon
    if (!domain || domain.startsWith("personal-") || hasError) {
        return <GlobeIcon className={className} strokeWidth={1.5} />;
    }

    // Use Google's favicon service with URL encoding
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;

    return (
        <img
            src={faviconUrl}
            alt=""
            className={className}
            onError={() => setHasError(true)}
        />
    );
}

/**
 * A toggle switch for choosing between Private and Team sharing modes.
 *
 * Layout: [Lock Icon] Private [===Switch===] [Org Icon] Org Name
 *
 * When toggled off (left): Private - only you can use this key/MCP
 * When toggled on (right): Team - shared with your organization
 */
export function PrivateTeamToggle({
    isTeam,
    onToggle,
    disabled = false,
    className,
}: PrivateTeamToggleProps) {
    const { organization } = useCurrentUser();

    // Get organization display name
    const orgName = organization?.name || "Team";

    return (
        <div
            className={cn(
                "flex items-center gap-2 text-sm",
                disabled && "opacity-50",
                className,
            )}
        >
            {/* Private label */}
            <div
                className={cn(
                    "flex items-center gap-1.5 transition-colors",
                    !isTeam
                        ? "text-foreground font-medium"
                        : "text-muted-foreground",
                )}
            >
                <LockIcon className="size-3.5" strokeWidth={1.5} />
                <span>Private</span>
            </div>

            {/* Switch */}
            <Switch
                checked={isTeam}
                onCheckedChange={onToggle}
                disabled={disabled}
                aria-label={isTeam ? "Shared with team" : "Private"}
            />

            {/* Team label with org icon */}
            <div
                className={cn(
                    "flex items-center gap-1.5 transition-colors",
                    isTeam
                        ? "text-foreground font-medium"
                        : "text-muted-foreground",
                )}
            >
                <OrgIcon domain={organization?.domain} className="size-3.5" />
                <span>{orgName}</span>
            </div>
        </div>
    );
}
