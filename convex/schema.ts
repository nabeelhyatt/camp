import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Camp Multiplayer Schema
 *
 * This schema supports the multiplayer architecture with:
 * - Organizations (domain-based grouping for work emails, solo for personal emails)
 * - Users (linked to Clerk, belong to one organization)
 * - Workspaces (team or personal, within an organization)
 * - Projects, Chats, Messages (nested structure for conversation data)
 * - API Keys, Model Preferences, MCP Configs (per-workspace settings)
 */
export default defineSchema({
    // Organizations - grouped by email domain
    organizations: defineTable({
        domain: v.string(), // "sparkcapital.com" or "personal-{clerkId}" for personal emails
        name: v.string(), // Display name, editable by owner
        ownerId: v.optional(v.id("users")), // First user from domain becomes owner
        clearbitData: v.optional(v.any()), // Cached Clearbit company data
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_domain", ["domain"])
        .index("by_owner", ["ownerId"]),

    // Users - linked to Clerk
    users: defineTable({
        clerkId: v.string(), // Clerk user ID (stable identifier)
        email: v.string(),
        displayName: v.string(),
        avatarUrl: v.optional(v.string()),
        orgId: v.id("organizations"),
        role: v.union(v.literal("owner"), v.literal("member")),
        activeWorkspaceId: v.optional(v.id("workspaces")),
        onboardingCompleted: v.boolean(),
        createdAt: v.number(),
        lastSeenAt: v.number(),
    })
        .index("by_clerk_id", ["clerkId"])
        .index("by_email", ["email"])
        .index("by_org", ["orgId"]),

    // Workspaces - team or personal
    workspaces: defineTable({
        orgId: v.id("organizations"),
        type: v.union(v.literal("team"), v.literal("personal")),
        ownerId: v.optional(v.id("users")), // Only for personal workspaces
        name: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_org", ["orgId"])
        .index("by_owner", ["ownerId"])
        .index("by_org_and_type", ["orgId", "type"]),

    // Workspace members - for team workspaces
    workspaceMembers: defineTable({
        workspaceId: v.id("workspaces"),
        userId: v.id("users"),
        role: v.union(
            v.literal("owner"),
            v.literal("admin"),
            v.literal("member")
        ),
        joinedAt: v.number(),
    })
        .index("by_workspace", ["workspaceId"])
        .index("by_user", ["userId"])
        .index("by_workspace_and_user", ["workspaceId", "userId"]),

    // Projects - folders for organizing chats
    projects: defineTable({
        workspaceId: v.id("workspaces"),
        name: v.string(),
        description: v.optional(v.string()),
        createdBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_workspace", ["workspaceId"])
        .index("by_created_by", ["createdBy"]),

    // Chats - conversation containers
    chats: defineTable({
        workspaceId: v.id("workspaces"),
        projectId: v.optional(v.id("projects")),
        title: v.optional(v.string()),
        createdBy: v.id("users"),
        isAmbient: v.boolean(), // Quick chat flag
        parentChatId: v.optional(v.id("chats")), // For branched conversations
        // Migrated from SQLite
        legacyId: v.optional(v.string()), // Original SQLite chat ID for reference
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_workspace", ["workspaceId"])
        .index("by_project", ["projectId"])
        .index("by_created_by", ["createdBy"])
        .index("by_legacy_id", ["legacyId"]),

    // Message sets - groups messages from one user prompt
    messageSets: defineTable({
        chatId: v.id("chats"),
        createdBy: v.id("users"),
        createdAt: v.number(),
    }).index("by_chat", ["chatId"]),

    // Messages - individual AI responses or user messages
    messages: defineTable({
        messageSetId: v.id("messageSets"),
        chatId: v.id("chats"), // Denormalized for easier queries
        role: v.union(v.literal("user"), v.literal("assistant")),
        model: v.optional(v.string()), // Model ID for assistant messages
        status: v.union(
            v.literal("pending"),
            v.literal("streaming"),
            v.literal("complete"),
            v.literal("error")
        ),
        errorMessage: v.optional(v.string()),
        // Streaming state
        streamingSessionId: v.optional(v.string()), // To track which session is streaming
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_message_set", ["messageSetId"])
        .index("by_chat", ["chatId"])
        .index("by_status", ["status"]),

    // Message parts - content chunks (text, code, tool calls, etc.)
    messageParts: defineTable({
        messageId: v.id("messages"),
        type: v.union(
            v.literal("text"),
            v.literal("code"),
            v.literal("tool_call"),
            v.literal("tool_result"),
            v.literal("image"),
            v.literal("file")
        ),
        content: v.string(), // Text content or JSON for structured data
        language: v.optional(v.string()), // For code blocks
        toolName: v.optional(v.string()), // For tool calls
        toolCallId: v.optional(v.string()), // Links tool_call to tool_result
        order: v.number(), // Display order within message
        createdAt: v.number(),
    })
        .index("by_message", ["messageId"])
        .index("by_tool_call_id", ["toolCallId"]),

    // Attachments - files attached to messages
    attachments: defineTable({
        messageId: v.optional(v.id("messages")), // Can be attached during chat before message exists
        chatId: v.id("chats"),
        uploadedBy: v.id("users"),
        storageId: v.string(), // Convex file storage ID
        filename: v.string(),
        mimeType: v.string(),
        sizeBytes: v.number(),
        createdAt: v.number(),
    })
        .index("by_message", ["messageId"])
        .index("by_chat", ["chatId"]),

    // API Keys - per-workspace, encrypted
    apiKeys: defineTable({
        workspaceId: v.id("workspaces"),
        provider: v.string(), // "openai", "anthropic", "google", etc.
        encryptedKey: v.string(), // Encrypted with workspace-specific key
        keyHint: v.string(), // Last 4 characters for display
        createdBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_workspace", ["workspaceId"])
        .index("by_workspace_and_provider", ["workspaceId", "provider"]),

    // Model preferences - per-workspace
    modelPreferences: defineTable({
        workspaceId: v.id("workspaces"),
        enabledModels: v.array(v.string()), // List of enabled model IDs
        defaultModels: v.array(v.string()), // Default models for new chats
        modelSettings: v.optional(v.any()), // Per-model settings (temperature, etc.)
        updatedBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_workspace", ["workspaceId"]),

    // MCP configurations - per-workspace
    mcpConfigs: defineTable({
        workspaceId: v.id("workspaces"),
        name: v.string(),
        type: v.union(v.literal("api"), v.literal("local")), // API-based or local binary
        config: v.any(), // MCP server configuration
        enabled: v.boolean(),
        createdBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_workspace", ["workspaceId"])
        .index("by_workspace_and_enabled", ["workspaceId", "enabled"]),

    // Presence - for real-time collaboration
    presence: defineTable({
        userId: v.id("users"),
        workspaceId: v.id("workspaces"),
        chatId: v.optional(v.id("chats")), // Current chat being viewed
        status: v.union(
            v.literal("active"),
            v.literal("idle"),
            v.literal("offline")
        ),
        lastHeartbeat: v.number(),
    })
        .index("by_user", ["userId"])
        .index("by_workspace", ["workspaceId"])
        .index("by_chat", ["chatId"]),

    // Invitations - for adding team members
    invitations: defineTable({
        orgId: v.id("organizations"),
        workspaceId: v.optional(v.id("workspaces")), // Specific workspace or whole org
        email: v.string(),
        role: v.union(
            v.literal("owner"),
            v.literal("admin"),
            v.literal("member")
        ),
        token: v.string(), // Unique invitation token
        invitedBy: v.id("users"),
        status: v.union(
            v.literal("pending"),
            v.literal("accepted"),
            v.literal("expired")
        ),
        expiresAt: v.number(),
        createdAt: v.number(),
    })
        .index("by_token", ["token"])
        .index("by_email", ["email"])
        .index("by_org", ["orgId"])
        .index("by_status", ["status"]),
});
