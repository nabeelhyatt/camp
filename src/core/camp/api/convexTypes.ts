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
// Sentinel ID Handling
// ============================================================

/**
 * SQLite uses special string IDs like "default" and "quick-chat" for projects.
 * Convex uses real Ids. These utilities handle the mapping.
 */

/** Sentinel IDs used by SQLite that don't exist in Convex */
export const SENTINEL_PROJECT_IDS = {
    DEFAULT: "default",
    QUICK_CHAT: "quick-chat",
} as const;

/** Type for sentinel project IDs - exported for use in components */
export type SentinelProjectId =
    (typeof SENTINEL_PROJECT_IDS)[keyof typeof SENTINEL_PROJECT_IDS];

/**
 * Check if a project ID is a SQLite sentinel (not a real Convex ID)
 */
export function isSentinelProjectId(id: string | undefined): boolean {
    return (
        id === SENTINEL_PROJECT_IDS.DEFAULT ||
        id === SENTINEL_PROJECT_IDS.QUICK_CHAT
    );
}

/**
 * Check if a chat should be treated as a quick/ambient chat based on projectId
 */
export function isQuickChatByProjectId(projectId: string | undefined): boolean {
    return projectId === SENTINEL_PROJECT_IDS.QUICK_CHAT;
}

/**
 * Check if an ID looks like a SQLite ID (32-char hex string / UUID without dashes).
 * SQLite IDs in this app are generated with uuidv4().replace(/-/g, '').
 * Convex IDs have a different format (shorter, different character set).
 *
 * This is used to detect when a SQLite ID is being used in a Convex context,
 * which happens when navigating to an existing SQLite chat while useConvexData=true.
 */
export function isSQLiteId(id: string | undefined): boolean {
    if (!id) return false;
    // SQLite IDs are 32-character hex strings (UUID without dashes)
    return /^[0-9a-f]{32}$/i.test(id);
}

/**
 * Check if an ID appears to be a valid Convex ID.
 * Returns false for SQLite IDs and sentinel IDs.
 */
export function isLikelyConvexId(id: string | undefined): boolean {
    if (!id) return false;
    if (isSentinelProjectId(id)) return false;
    if (isSQLiteId(id)) return false;
    // If it's not a sentinel or SQLite ID, assume it's a Convex ID
    return true;
}

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
 * Convert a string back to a Convex Id for API calls.
 * Returns undefined if the string is a sentinel ID.
 */
export function stringToConvexId<T extends TableNames>(
    str: string,
): Id<T> | undefined {
    // Don't try to convert sentinel IDs - they don't exist in Convex
    if (isSentinelProjectId(str)) {
        return undefined;
    }
    return str as unknown as Id<T>;
}

/**
 * Convert a string to Convex Id, throwing if it's a sentinel.
 * Use when you know the ID must be a real Convex ID.
 */
export function stringToConvexIdStrict<T extends TableNames>(
    str: string,
): Id<T> {
    if (isSentinelProjectId(str)) {
        throw new Error(
            `Cannot convert sentinel ID "${str}" to Convex Id. Use stringToConvexId for optional handling.`,
        );
    }
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
        contextText: doc.contextText ?? "", // Project context for AI conversations
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
 * - projectId: Maps to "default" for ungrouped, "quick-chat" for ambient
 */
export function convexChatToChat(doc: Doc<"chats">): Chat {
    // Map projectId for compatibility with SQLite expectations
    let projectId: string;
    if (doc.isAmbient) {
        projectId = SENTINEL_PROJECT_IDS.QUICK_CHAT;
    } else if (doc.projectId) {
        projectId = convexIdToString(doc.projectId);
    } else {
        projectId = SENTINEL_PROJECT_IDS.DEFAULT;
    }

    return {
        id: convexIdToString(doc._id),
        title: doc.title ?? "New Chat",
        projectId,
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
        // Map forkFromMessageId to replyToId for RepliesDrawer compatibility
        replyToId: doc.forkFromMessageId
            ? convexIdToString(doc.forkFromMessageId)
            : null,
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

// ============================================================
// Message Types (for conversion)
// ============================================================

import type {
    MessageSetDetail,
    Message,
    MessagePart,
    UserBlock,
    ChatBlock,
    CompareBlock,
    BrainstormBlock,
    ToolsBlock,
    BlockType,
} from "@core/chorus/ChatState";

/**
 * Message part from Convex
 */
export interface ConvexMessagePart {
    id: string;
    type: "text" | "code" | "tool_call" | "tool_result" | "image" | "file";
    content: string;
    language?: string;
    toolName?: string;
    toolCallId?: string;
    order: number;
}

/**
 * Message from Convex
 */
export interface ConvexMessage {
    id: string;
    messageSetId: string;
    chatId: string;
    role: "user" | "assistant";
    model?: string;
    status: "pending" | "streaming" | "complete" | "stopped" | "error";
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
    parts: ConvexMessagePart[];
}

/**
 * Message set from Convex with author info
 */
export interface ConvexMessageSet {
    id: string;
    chatId: string;
    createdAt: string;
    authorSnapshot?: AuthorSnapshot;
    showAttribution: boolean;
    messages: ConvexMessage[];
}

// ============================================================
// Message Transformation Functions
// ============================================================

/**
 * Convert a Convex message part to the SQLite MessagePart format
 */
function convertConvexPart(
    part: ConvexMessagePart,
    chatId: string,
    messageId: string,
): MessagePart {
    return {
        chatId,
        messageId,
        level: part.order,
        content: part.content,
        // Tool calls/results are stored differently in Convex - not in parts
        toolCalls: undefined,
        toolResults: undefined,
    };
}

/**
 * Convert a Convex message to the SQLite Message format
 */
function convertConvexMessage(msg: ConvexMessage): Message {
    // Combine all text parts into a single text field
    const textParts = msg.parts.filter((p) => p.type === "text");
    const text = textParts.map((p) => p.content).join("");

    // Map Convex status to SQLite state
    const state: "streaming" | "idle" =
        msg.status === "streaming" ? "streaming" : "idle";

    // Determine blockType from role
    // In Convex, we simplified to just role (user/assistant)
    // Map assistant → "tools" (the default block type)
    const blockType: BlockType = msg.role === "user" ? "user" : "tools";

    return {
        id: msg.id,
        chatId: msg.chatId,
        messageSetId: msg.messageSetId,
        blockType,
        text,
        model: msg.model || (msg.role === "user" ? "user" : "unknown"),
        selected: true, // Default to selected for now
        attachments: undefined, // Attachments not yet in Convex
        isReview: false,
        state,
        streamingToken: undefined,
        errorMessage: msg.errorMessage,
        reviewState: undefined,
        level: undefined,
        parts: msg.parts.map((p) => convertConvexPart(p, msg.chatId, msg.id)),
        replyChatId: undefined,
        branchedFromId: undefined,
    };
}

/**
 * Extended MessageSetDetail with author attribution for Convex
 * The base MessageSetDetail type is from SQLite and doesn't include author info.
 */
export interface MessageSetDetailWithAttribution extends MessageSetDetail {
    authorSnapshot?: AuthorSnapshot;
    showAttribution: boolean;
}

/**
 * Convert Convex message sets to MessageSetDetail format with attribution
 *
 * This transformation allows the existing MultiChat.tsx UI to render
 * Convex data without changes, plus adds author attribution info.
 */
export function convertConvexToMessageSetDetails(
    convexSets: ConvexMessageSet[],
): MessageSetDetailWithAttribution[] {
    // Filter out any null/undefined sets that might have slipped through
    return convexSets
        .filter((set) => set != null)
        .map((set, index) => {
            // Convert all messages
            const messages = set.messages.map(convertConvexMessage);

            // Separate by block type
            const userBlockMessages = messages.filter(
                (m) => m.blockType === "user",
            );
            const toolsBlockMessages = messages.filter(
                (m) => m.blockType === "tools",
            );

            // Build blocks (compare and brainstorm are deprecated, but structure needs them)
            const userBlock: UserBlock = {
                type: "user",
                message: userBlockMessages[0],
            };

            const chatBlock: ChatBlock = {
                type: "chat",
                message: undefined, // Deprecated
                reviews: [],
            };

            const compareBlock: CompareBlock = {
                type: "compare",
                messages: [],
                synthesis: undefined,
            };

            const brainstormBlock: BrainstormBlock = {
                type: "brainstorm",
                ideaMessages: [],
            };

            const toolsBlock: ToolsBlock = {
                type: "tools",
                chatMessages: toolsBlockMessages,
            };

            // Determine set type from messages
            const hasUserMessage = userBlockMessages.length > 0;
            const type = hasUserMessage ? "user" : "ai";

            // Default selected block type
            const selectedBlockType: BlockType = hasUserMessage
                ? "user"
                : "tools";

            return {
                id: set.id,
                chatId: set.chatId,
                type,
                level: index,
                selectedBlockType,
                createdAt: set.createdAt,
                userBlock,
                chatBlock,
                compareBlock,
                brainstormBlock,
                toolsBlock,
                // Author attribution (Convex only - not in SQLite MessageSetDetail type)
                authorSnapshot: set.authorSnapshot,
                showAttribution: set.showAttribution,
            };
        });
}
