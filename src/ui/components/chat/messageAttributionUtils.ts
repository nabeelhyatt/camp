import type { AuthorSnapshot } from "./MessageAttribution";

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
