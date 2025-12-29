/**
 * Type Transformers for Convex <-> Frontend
 *
 * Maps between Convex document types (with Id<"table"> and _id) and
 * frontend types (with string ids and camelCase).
 *
 * This enables compatibility between the Convex data layer and
 * existing UI components that expect the SQLite-based types.
 */

import { Doc, Id } from "@convex/_generated/dataModel";
import type { Project } from "@core/chorus/api/ProjectAPI";
import type { Chat } from "@core/chorus/api/ChatAPI";

// ============================================================
// ID Conversion Utilities
// ============================================================

import type { TableNames } from "@convex/_generated/dataModel";

/**
 * Convert a Convex Id to a string for use in URLs and existing code
 */
export function convexIdToString<T extends TableNames>(id: Id<T>): string {
    return id as unknown as string;
}

/**
 * Convert a string back to a Convex Id for API calls
 */
export function stringToConvexId<T extends TableNames>(str: string): Id<T> {
    return str as unknown as Id<T>;
}

/**
 * Convert an optional Convex Id to an optional string
 */
export function optionalConvexIdToString<T extends TableNames>(
    id: Id<T> | undefined,
): string | undefined {
    return id ? convexIdToString(id) : undefined;
}

// ============================================================
// Project Transformers
// ============================================================

// Local storage key for collapsed projects
const COLLAPSED_PROJECTS_KEY = "camp:collapsedProjects";

/**
 * Get the set of collapsed project IDs from localStorage
 */
function getCollapsedProjects(): Set<string> {
    try {
        const stored = localStorage.getItem(COLLAPSED_PROJECTS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as string[];
            return new Set(parsed);
        }
    } catch {
        // Ignore parse errors
    }
    return new Set();
}

/**
 * Transform a Convex project document to the frontend Project type
 *
 * Notes:
 * - isCollapsed: Stored in localStorage (UI state, not synced)
 * - contextText: Not in Convex schema yet, defaults to undefined
 * - magicProjectsEnabled: Not in Convex schema, defaults to false
 * - isImported: Not applicable for Convex, defaults to false
 */
export function convexProjectToProject(doc: Doc<"projects">): Project {
    const projectId = convexIdToString(doc._id);
    const collapsed = getCollapsedProjects();

    return {
        id: projectId,
        name: doc.name,
        updatedAt: new Date(doc.updatedAt).toISOString(),
        createdAt: new Date(doc.createdAt).toISOString(),
        // isCollapsed is stored in localStorage for persistence
        isCollapsed: collapsed.has(projectId),
        contextText: undefined, // TODO: Add to Convex schema or handle separately
        magicProjectsEnabled: false, // TODO: Add to Convex schema if needed
        isImported: false, // Not applicable for Convex-created projects
    };
}

/**
 * Transform an array of Convex project documents
 */
export function convexProjectsToProjects(docs: Doc<"projects">[]): Project[] {
    return docs.map(convexProjectToProject);
}

// ============================================================
// Chat Transformers
// ============================================================

/**
 * Transform a Convex chat document to the frontend Chat type
 *
 * Notes:
 * - Convex uses isAmbient, frontend uses quickChat
 * - Convex uses optional fields, frontend uses null for some
 * - summary, projectContextSummary, replyToId not in Convex schema yet
 * - gcPrototype: deprecated field, defaults to false
 */
export function convexChatToChat(doc: Doc<"chats">): Chat {
    return {
        id: convexIdToString(doc._id),
        title: doc.title ?? "New Chat",
        projectId: doc.projectId ? convexIdToString(doc.projectId) : "",
        updatedAt: new Date(doc.updatedAt).toISOString(),
        createdAt: new Date(doc.createdAt).toISOString(),
        quickChat: doc.isAmbient,
        pinned: false, // deprecated field
        summary: null, // TODO: Add to Convex schema if needed
        isNewChat: false, // Convex chats are never "new" in the same sense
        parentChatId: doc.parentChatId
            ? convexIdToString(doc.parentChatId)
            : null,
        projectContextSummary: undefined, // TODO: Add to Convex schema if needed
        projectContextSummaryIsStale: false,
        replyToId: null, // TODO: Add to Convex schema if needed
        gcPrototype: false, // deprecated
    };
}

/**
 * Transform an array of Convex chat documents
 */
export function convexChatsToChats(docs: Doc<"chats">[]): Chat[] {
    return docs.map(convexChatToChat);
}

// ============================================================
// Extended Chat Type with Multiplayer Fields
// ============================================================

/**
 * Extended Chat type that includes Convex-specific multiplayer fields
 *
 * Use this type when you need access to:
 * - visibility (team/private)
 * - forkFromMessageId
 * - forkDepth
 * - rootChatId
 * - createdBy
 */
export interface ConvexChat extends Chat {
    visibility: "team" | "private" | undefined;
    forkFromMessageId: string | undefined;
    forkDepth: number | undefined;
    rootChatId: string | undefined;
    createdBy: string;
}

/**
 * Transform a Convex chat document to the extended ConvexChat type
 */
export function convexChatToConvexChat(doc: Doc<"chats">): ConvexChat {
    return {
        ...convexChatToChat(doc),
        visibility: doc.visibility,
        forkFromMessageId: doc.forkFromMessageId
            ? convexIdToString(doc.forkFromMessageId)
            : undefined,
        forkDepth: doc.forkDepth,
        rootChatId: doc.rootChatId
            ? convexIdToString(doc.rootChatId)
            : undefined,
        createdBy: convexIdToString(doc.createdBy),
    };
}

// ============================================================
// Author Snapshot Type
// ============================================================

/**
 * Author information embedded in message sets for attribution
 */
export interface AuthorSnapshot {
    userId: string;
    displayName: string;
    avatarUrl?: string;
}

/**
 * Transform a Convex author snapshot to the frontend type
 */
export function convexAuthorSnapshotToAuthorSnapshot(
    snapshot:
        | {
              userId: Id<"users">;
              displayName: string;
              avatarUrl?: string;
          }
        | undefined,
): AuthorSnapshot | undefined {
    if (!snapshot) return undefined;
    return {
        userId: convexIdToString(snapshot.userId),
        displayName: snapshot.displayName,
        avatarUrl: snapshot.avatarUrl,
    };
}

// ============================================================
// Date/Time Utilities
// ============================================================

/**
 * Convert a Convex timestamp (number) to ISO string
 */
export function timestampToISOString(timestamp: number): string {
    return new Date(timestamp).toISOString();
}

/**
 * Convert an ISO string to a Convex timestamp (number)
 */
export function isoStringToTimestamp(isoString: string): number {
    return new Date(isoString).getTime();
}
