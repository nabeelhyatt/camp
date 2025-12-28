import { formatDistanceToNow } from "date-fns";

/**
 * MessageAttribution - Slack-style author display for team chats
 *
 * Displays: [Avatar] Name 12:34 PM
 *
 * Used in team/shared chats to show who sent each message.
 * Hidden in private chats owned by the current user.
 *
 * Author data comes from embedded snapshot in MessageSet,
 * avoiding expensive joins while maintaining historical accuracy.
 */

export interface AuthorSnapshot {
    userId: string;
    displayName: string;
    avatarUrl?: string;
}

interface MessageAttributionProps {
    author: AuthorSnapshot;
    timestamp: number;
    /** Whether this is a new author block (shows full attribution) vs continuation */
    isNewAuthorBlock?: boolean;
    /** Compact mode for inline display */
    compact?: boolean;
}

/**
 * Full attribution with avatar, name, and time
 */
export function MessageAttribution({
    author,
    timestamp,
    isNewAuthorBlock = true,
    compact = false,
}: MessageAttributionProps) {
    if (!isNewAuthorBlock) {
        // Continuation of same author - just show timestamp on hover
        return <MessageTimestamp timestamp={timestamp} />;
    }

    const timeString = formatTime(timestamp);

    if (compact) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <AuthorAvatar author={author} size="sm" />
                <span className="font-medium text-foreground">
                    {author.displayName}
                </span>
                <span>{timeString}</span>
            </span>
        );
    }

    return (
        <div className="flex items-center gap-2 mb-1">
            <AuthorAvatar author={author} size="md" />
            <div className="flex items-baseline gap-2">
                <span className="font-semibold text-sm text-foreground">
                    {author.displayName}
                </span>
                <span className="text-xs text-muted-foreground">
                    {timeString}
                </span>
            </div>
        </div>
    );
}

/**
 * Author avatar with fallback to initials
 */
function AuthorAvatar({
    author,
    size = "md",
}: {
    author: AuthorSnapshot;
    size?: "sm" | "md" | "lg";
}) {
    const sizeClasses = {
        sm: "size-4 text-[8px]",
        md: "size-6 text-xs",
        lg: "size-8 text-sm",
    };

    const initials = getInitials(author.displayName);

    if (author.avatarUrl) {
        return (
            <img
                src={author.avatarUrl}
                alt={author.displayName}
                className={`${sizeClasses[size]} rounded-full object-cover`}
            />
        );
    }

    // Fallback to initials with generated color
    const bgColor = stringToColor(author.userId);

    return (
        <div
            className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-medium text-white`}
            style={{ backgroundColor: bgColor }}
        >
            {initials}
        </div>
    );
}

/**
 * Timestamp shown on hover for message continuations
 */
function MessageTimestamp({ timestamp }: { timestamp: number }) {
    const timeString = formatTime(timestamp);

    return (
        <span className="text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
            {timeString}
        </span>
    );
}

/**
 * Relative time display (e.g., "2 minutes ago")
 * Used for recent messages
 */
export function RelativeTime({ timestamp }: { timestamp: number }) {
    const relative = formatDistanceToNow(new Date(timestamp), {
        addSuffix: true,
    });

    return (
        <span
            className="text-xs text-muted-foreground"
            title={formatTime(timestamp)}
        >
            {relative}
        </span>
    );
}

// ============================================================
// Utility functions
// ============================================================

function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

function getInitials(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
        return "?";
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
    }
    return (
        parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
}

/**
 * Generate a consistent color from a string (user ID)
 * Uses a simple hash to pick from a palette of nice colors
 */
function stringToColor(str: string): string {
    const colors = [
        "#E91E63", // Pink
        "#9C27B0", // Purple
        "#673AB7", // Deep Purple
        "#3F51B5", // Indigo
        "#2196F3", // Blue
        "#03A9F4", // Light Blue
        "#00BCD4", // Cyan
        "#009688", // Teal
        "#4CAF50", // Green
        "#8BC34A", // Light Green
        "#FF9800", // Orange
        "#FF5722", // Deep Orange
    ];

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
}

// ============================================================
// Helper to determine if attribution should be shown
// ============================================================

export interface MessageSetForAttribution {
    authorSnapshot?: AuthorSnapshot;
    createdAt: number;
}

/**
 * Determine if a message set should show author attribution
 * based on visibility and authorship
 */
export function shouldShowAttribution(
    visibility: "team" | "private" | undefined,
    isOwnMessage: boolean,
): boolean {
    // Always show in team chats
    if (visibility === "team") {
        return true;
    }

    // In private chats, only show if viewing someone else's fork
    // (which shouldn't normally happen, but for completeness)
    if (visibility === "private" && !isOwnMessage) {
        return true;
    }

    return false;
}

/**
 * Check if this message set starts a new author block
 * (different author than previous message set)
 */
export function isNewAuthorBlock(
    current: MessageSetForAttribution,
    previous: MessageSetForAttribution | undefined,
    timeGapMinutes: number = 5,
): boolean {
    if (!previous) {
        return true;
    }

    // Different author
    if (current.authorSnapshot?.userId !== previous.authorSnapshot?.userId) {
        return true;
    }

    // Same author but significant time gap
    const timeDiff = current.createdAt - previous.createdAt;
    if (timeDiff > timeGapMinutes * 60 * 1000) {
        return true;
    }

    return false;
}
