# Camp Multiplayer Architecture Migration Specification

## Executive Summary

This document provides comprehensive specifications for migrating Camp from a single-user, local-only architecture to a multiplayer cloud-based system. The migration introduces Clerk authentication, Convex as the primary data layer, real-time collaboration features, and team-based organization.

**Stack**: Clerk (auth) + Convex (database/real-time) + Chorus (model proxying, unchanged)

**Total Development Estimate**: 10-14 weeks (simplified by no legacy migration)

---

## Key Decisions (from PRD discussion)

| Decision | Answer |
|----------|--------|
| Auth provider | Clerk with Google OAuth (Apple later) |
| Database | Convex |
| Workspace model | Team-first (domain-based) + Personal spaces |
| Legacy SQLite chats | None to migrate (no existing users) |
| Offline behavior | Optimistic updates with auto-sync |
| Email provider | Convex Resend component |
| Anonymous mode | No - sign-in required |
| Usage tracking | Yes - tie to Clerk user ID for future billing |

---

## Workspace & Permissions Model

### Two Workspace Types

1. **Team Workspace** (primary)
   - Created automatically from email domain (e.g., `sparkcapital.com` → "Spark Capital")
   - All team members see all content by default
   - Owner can rename, configure team settings

2. **Personal Workspace**
   - Every user gets one personal workspace
   - Private by default
   - Can share individual projects into team workspace

### Permission Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ORGANIZATION                             │
│  (derived from email domain, e.g., sparkcapital.com)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐     ┌─────────────────────┐            │
│  │   TEAM WORKSPACE    │     │  PERSONAL WORKSPACE │            │
│  │   (shared by all)   │     │  (per user)         │            │
│  │                     │     │                     │            │
│  │  ┌───────────────┐  │     │  ┌───────────────┐  │            │
│  │  │   PROJECT A   │  │     │  │  MY PROJECT   │  │            │
│  │  │   - Chat 1    │  │     │  │  - Chat X     │  │────────────┼──▶ Share to Team
│  │  │   - Chat 2    │  │     │  │  - Chat Y     │  │            │
│  │  └───────────────┘  │     │  └───────────────┘  │            │
│  │                     │     │                     │            │
│  │  ┌───────────────┐  │     └─────────────────────┘            │
│  │  │   PROJECT B   │  │                                        │
│  │  │   (password)  │◀─┼─── Optional per-project auth           │
│  │  └───────────────┘  │                                        │
│  │                     │                                        │
│  └─────────────────────┘                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sharing Model (Phase 2+)

**Design Principles:**
1. Sharing should be super easy - copy URL, share it
2. URLs dictate access (shareable links)
3. Future: per-project password protection

**Link Types (planned):**
- `camp.so/t/{team-slug}/p/{project-id}` - Team project (requires org auth)
- `camp.so/s/{share-token}` - Shareable link (anyone with link + optional password)

### Permission Levels

| Level | Scope | Who |
|-------|-------|-----|
| **Organization** | All team workspaces | Members with matching email domain |
| **Workspace** | Team or Personal | Owner (personal) or all org members (team) |
| **Project** | Individual project | Configurable: org-only, link-access, password-protected |

### Phase 1 Permissions (MVP)

For phase 1, we simplify:
- Team workspace: all org members can read/write everything
- Personal workspace: owner only
- No project-level permissions yet
- No shareable links yet

```typescript
// convex/permissions.ts (Phase 1 - simplified)
export type WorkspaceRole = "owner" | "member";

export function canAccessWorkspace(
  user: User,
  workspace: Workspace
): boolean {
  if (workspace.type === "personal") {
    return workspace.ownerId === user._id;
  }
  // Team workspace: check org membership
  return user.orgId === workspace.orgId;
}

export function canAccessProject(
  user: User,
  project: Project
): boolean {
  return canAccessWorkspace(user, project.workspace);
}
```

---

## Spec 1: Authentication & User Management

### Goals
- Enable secure user authentication via Clerk (Google OAuth)
- Auto-create organization from email domain
- Auto-create team + personal workspaces on first sign-in
- Sync user profiles to Convex

### Non-Goals
- Apple Sign-In (later)
- Magic links
- Anonymous/guest mode

### Technical Approach

#### 1.1 Clerk Setup

```typescript
// src/core/camp/auth/ClerkProvider.tsx (new Tier 3 file)
import { ClerkProvider as BaseClerkProvider } from "@clerk/clerk-react";

export function CampClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
    >
      {children}
    </BaseClerkProvider>
  );
}
```

#### 1.2 OAuth Deep Link Flow

```
User clicks "Sign in with Google"
    │
    ▼
Clerk opens Google OAuth in system browser
    │
    ▼
Google authenticates user
    │
    ▼
Redirect to camp://auth/callback?token=...
    │
    ▼
Tauri handles deep link
    │
    ▼
Complete Clerk session
    │
    ▼
Sync user to Convex (upsert)
    │
    ▼
Create org/workspaces if first sign-in
```

**tauri.conf.json addition:**
```json
{
  "tauri": {
    "bundle": {
      "macOS": {
        "urlScheme": ["camp"]
      }
    }
  }
}
```

#### 1.3 Convex User/Org Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Organizations (derived from email domains)
  organizations: defineTable({
    domain: v.string(),           // e.g., "sparkcapital.com" or "personal-{clerkId}"
    name: v.string(),             // e.g., "Spark Capital" (editable by owner)
    ownerId: v.optional(v.id("users")), // First user from domain, can transfer
    createdAt: v.number(),
  })
    .index("by_domain", ["domain"])
    .index("by_owner", ["ownerId"]),

  // Users
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    orgId: v.id("organizations"),
    role: v.union(v.literal("owner"), v.literal("member")), // Org-level role
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_org", ["orgId"]),

  // Workspaces
  workspaces: defineTable({
    orgId: v.id("organizations"),
    type: v.union(v.literal("team"), v.literal("personal")),
    ownerId: v.optional(v.id("users")), // null for team, set for personal
    name: v.string(),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_owner", ["ownerId"]),
});
```

#### 1.4 First Sign-In Flow

```typescript
// convex/auth.ts
const PERSONAL_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com",
  "live.com", "yahoo.com", "icloud.com", "me.com", "aol.com",
  "protonmail.com", "proton.me"
];

export const handleFirstSignIn = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      await ctx.db.patch(existingUser._id, { lastSeenAt: Date.now() });
      return existingUser._id;
    }

    const domain = args.email.split("@")[1];
    const isPersonalEmail = PERSONAL_EMAIL_DOMAINS.includes(domain.toLowerCase());

    let org;
    let isFirstUserInOrg = false;

    if (isPersonalEmail) {
      // Personal email: create solo org for this user (no team workspace)
      const orgId = await ctx.db.insert("organizations", {
        domain: `personal-${args.clerkId}`, // Unique per user
        name: args.displayName,
        ownerId: undefined, // Will update after user created
        createdAt: Date.now(),
      });
      org = await ctx.db.get(orgId);
      isFirstUserInOrg = true;
    } else {
      // Work email: get or create org for domain
      org = await ctx.db
        .query("organizations")
        .withIndex("by_domain", (q) => q.eq("domain", domain))
        .first();

      if (!org) {
        isFirstUserInOrg = true;

        // Try Clearbit for company name, fallback to formatted domain
        const orgName = await getCompanyName(domain);

        const orgId = await ctx.db.insert("organizations", {
          domain,
          name: orgName,
          ownerId: undefined, // Will update after user created
          createdAt: Date.now(),
        });
        org = await ctx.db.get(orgId);
      }
    }

    // Create user
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      displayName: args.displayName,
      avatarUrl: args.avatarUrl,
      orgId: org!._id,
      role: isFirstUserInOrg ? "owner" : "member",
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });

    // Update org owner if first user
    if (isFirstUserInOrg) {
      await ctx.db.patch(org!._id, { ownerId: userId });
    }

    // Create team workspace (only for work emails, and only once per org)
    if (!isPersonalEmail && isFirstUserInOrg) {
      await ctx.db.insert("workspaces", {
        orgId: org!._id,
        type: "team",
        ownerId: undefined,
        name: `${org!.name} Team`,
        createdAt: Date.now(),
      });
    }

    // Create personal workspace (everyone gets one)
    await ctx.db.insert("workspaces", {
      orgId: org!._id,
      type: "personal",
      ownerId: userId,
      name: "Personal",
      createdAt: Date.now(),
    });

    return userId;
  },
});

async function getCompanyName(domain: string): Promise<string> {
  try {
    // Try Clearbit Company API
    const response = await fetch(
      `https://company.clearbit.com/v2/companies/find?domain=${domain}`,
      { headers: { Authorization: `Bearer ${process.env.CLEARBIT_API_KEY}` } }
    );
    if (response.ok) {
      const data = await response.json();
      if (data.name) return data.name;
    }
  } catch {
    // Clearbit failed, use fallback
  }

  // Fallback: format domain name
  return formatDomainAsName(domain);
}

function formatDomainAsName(domain: string): string {
  // sparkcapital.com → Sparkcapital
  const name = domain.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}
```

### UI Changes

1. **Replace Onboarding.tsx**: Show Clerk sign-in (Google button only)
2. **Add UserMenu**: Avatar + dropdown in sidebar footer
3. **Protected Routes**: Redirect to sign-in if not authenticated

### Effort Estimate
- **Development**: 2-3 weeks
- **Testing**: 1 week

---

## Spec 2: Convex Data Layer

### Goals
- All chat data stored in Convex (no SQLite for new data)
- Real-time sync via Convex subscriptions
- Optimistic updates for responsive UI
- Track user attribution on all entities

### Non-Goals
- SQLite migration (no existing users)
- Full offline support (optimistic updates only)

### Technical Approach

#### 2.1 Full Convex Schema

```typescript
// convex/schema.ts (complete)
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // === Auth & Org (from Spec 1) ===
  organizations: defineTable({
    domain: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_domain", ["domain"]),

  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    orgId: v.id("organizations"),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_org", ["orgId"]),

  workspaces: defineTable({
    orgId: v.id("organizations"),
    type: v.union(v.literal("team"), v.literal("personal")),
    ownerId: v.optional(v.id("users")),
    name: v.string(),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_owner", ["ownerId"]),

  // === Projects ===
  projects: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    contextText: v.optional(v.string()),
    isCollapsed: v.boolean(),
    magicProjectsEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_updated", ["workspaceId", "updatedAt"]),

  // === Chats ===
  chats: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    isQuickChat: v.boolean(),
    parentChatId: v.optional(v.id("chats")),
    summary: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_updated", ["projectId", "updatedAt"])
    .index("by_parent", ["parentChatId"]),

  // === Messages ===
  // Using Convex Agent Component structure
  messageSets: defineTable({
    chatId: v.id("chats"),
    type: v.union(v.literal("user"), v.literal("ai")),
    level: v.number(),
    selectedBlockType: v.string(),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_chat", ["chatId"])
    .index("by_chat_level", ["chatId", "level"]),

  messages: defineTable({
    chatId: v.id("chats"),
    messageSetId: v.id("messageSets"),
    text: v.string(),
    model: v.string(),
    blockType: v.string(),
    selected: v.boolean(),
    state: v.union(v.literal("streaming"), v.literal("idle")),
    errorMessage: v.optional(v.string()),
    isReview: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_chat", ["chatId"])
    .index("by_message_set", ["messageSetId"])
    .index("by_streaming", ["state"]),

  messageParts: defineTable({
    messageId: v.id("messages"),
    level: v.number(),
    content: v.string(),
    toolCalls: v.optional(v.string()),
    toolResults: v.optional(v.string()),
  }).index("by_message", ["messageId"]),

  // === Attachments ===
  attachments: defineTable({
    type: v.string(),
    originalName: v.string(),
    storageId: v.id("_storage"),
    isLoading: v.boolean(),
    uploadedBy: v.id("users"),
    createdAt: v.number(),
  }),

  messageAttachments: defineTable({
    messageId: v.id("messages"),
    attachmentId: v.id("attachments"),
  })
    .index("by_message", ["messageId"])
    .index("by_attachment", ["attachmentId"]),

  // === User Settings ===
  userSettings: defineTable({
    userId: v.id("users"),
    apiKeys: v.string(),           // Encrypted JSON
    modelPreferences: v.optional(v.string()),
    mcpServers: v.optional(v.string()),  // API-based only
  }).index("by_user", ["userId"]),

  // === Presence (Phase 2) ===
  presence: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    chatId: v.optional(v.id("chats")),
    lastActiveAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_chat", ["chatId"])
    .index("by_user", ["userId"]),

  // === Tool Executions (idempotency) ===
  toolExecutions: defineTable({
    messageId: v.id("messages"),
    toolCallId: v.string(),
    toolName: v.string(),
    args: v.any(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_tool_call", ["toolCallId"])
    .index("by_message", ["messageId"]),

  // === Workspace Invites (Phase 2) ===
  workspaceInvites: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    token: v.string(),
    invitedBy: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_workspace", ["workspaceId"])
    .index("by_email", ["email"]),

  // === Usage Tracking (for future billing) ===
  usageEvents: defineTable({
    userId: v.id("users"),
    orgId: v.id("organizations"),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_user_date", ["userId", "createdAt"]),
});
```

#### 2.2 Optimistic Updates Pattern

Convex supports optimistic updates for responsive UI:

```typescript
// src/core/camp/hooks/useCreateMessage.ts
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

export function useCreateMessage() {
  const createMessage = useMutation(api.messages.create);

  return createMessage.withOptimisticUpdate((localStore, args) => {
    // Get current messages
    const existingMessages = localStore.getQuery(api.messages.list, {
      chatId: args.chatId,
    });

    if (existingMessages === undefined) return;

    // Optimistically add the new message
    const optimisticMessage = {
      _id: `temp_${Date.now()}` as any,
      chatId: args.chatId,
      text: args.text,
      state: "idle" as const,
      createdAt: Date.now(),
      // ... other fields
    };

    localStore.setQuery(api.messages.list, { chatId: args.chatId }, [
      ...existingMessages,
      optimisticMessage,
    ]);
  });
}
```

#### 2.3 Replace TanStack Query with Convex Hooks

Current pattern (TanStack Query):
```typescript
// Before
const { data: chats } = useQuery({
  queryKey: ["chats", projectId],
  queryFn: () => fetchChats(projectId),
});
```

New pattern (Convex):
```typescript
// After
const chats = useQuery(api.chats.list, { projectId });
```

Convex handles:
- Real-time updates (no polling)
- Caching
- Loading/error states

### Effort Estimate
- **Development**: 3-4 weeks
- **Testing**: 1 week

---

## Spec 3: Real-Time Messaging

### Goals
- Stream AI responses to all viewers of a chat
- User attribution on every message
- Maintain Chorus provider patterns (Tier 1 files unchanged)
- Evaluate Convex Agent Component

### Technical Approach

#### 3.1 Streaming Architecture

```
┌─────────────┐     ┌───────────────┐     ┌──────────────┐
│  Client A   │────▶│  Convex       │────▶│  Chorus      │
│  (sender)   │     │  Action       │     │  (provider)  │
└─────────────┘     │               │     └──────────────┘
                    │  Stream       │            │
                    │  to DB        │◀───────────┘
                    │               │     Token stream
                    └───────────────┘
                           │
                           │ Convex subscription
                           ▼
                    ┌──────────────┐
                    │  Client B    │
                    │  (viewer)    │
                    └──────────────┘
```

#### 3.2 Message Streaming Implementation

```typescript
// convex/streaming.ts
import { action, mutation } from "./_generated/server";
import { v } from "convex/values";

export const streamMessage = action({
  args: {
    chatId: v.id("chats"),
    prompt: v.string(),
    modelConfig: v.object({...}),
  },
  handler: async (ctx, args) => {
    // Create message in "streaming" state
    const messageId = await ctx.runMutation(internal.messages.create, {
      chatId: args.chatId,
      text: "",
      state: "streaming",
      model: args.modelConfig.model,
    });

    try {
      // Call Chorus provider (unchanged Tier 1 code)
      const response = await fetch(`${CHORUS_URL}/v1/chat/completions`, {
        method: "POST",
        body: JSON.stringify({
          model: args.modelConfig.model,
          messages: [...],
          stream: true,
        }),
      });

      let fullText = "";
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        fullText += parseChunk(chunk);

        // Update message with accumulated text
        await ctx.runMutation(internal.messages.updateText, {
          messageId,
          text: fullText,
        });
      }

      // Mark complete
      await ctx.runMutation(internal.messages.complete, { messageId });

      // Track usage
      await ctx.runMutation(internal.usage.track, {
        userId: args.userId,
        model: args.modelConfig.model,
        inputTokens: countTokens(args.prompt),
        outputTokens: countTokens(fullText),
      });

    } catch (error) {
      await ctx.runMutation(internal.messages.setError, {
        messageId,
        error: error.message,
      });
    }
  },
});
```

#### 3.3 Tool Call Idempotency

When multiple clients view a chat, only one should execute tool calls:

```typescript
// convex/tools.ts
export const executeToolCall = mutation({
  args: {
    messageId: v.id("messages"),
    toolCallId: v.string(),
    toolName: v.string(),
    args: v.any(),
  },
  handler: async (ctx, args) => {
    // Check if already running/completed
    const existing = await ctx.db
      .query("toolExecutions")
      .withIndex("by_tool_call", (q) => q.eq("toolCallId", args.toolCallId))
      .first();

    if (existing) {
      // Already handled - return existing result
      return existing.result;
    }

    // Lock this execution
    const executionId = await ctx.db.insert("toolExecutions", {
      messageId: args.messageId,
      toolCallId: args.toolCallId,
      toolName: args.toolName,
      args: args.args,
      status: "running",
      startedAt: Date.now(),
    });

    // Execute via action (for network access)
    await ctx.scheduler.runAfter(0, internal.tools.run, {
      executionId,
      toolName: args.toolName,
      args: args.args,
    });

    return executionId;
  },
});
```

### Effort Estimate
- **Development**: 2-3 weeks
- **Testing**: 1 week

---

## Spec 4: Workspaces & Collaboration (Phase 2)

### Goals
- Workspace switcher in UI
- Real-time presence indicators
- Team invitation flow
- Future: shareable project links

### Technical Approach

#### 4.1 Workspace Switcher

```typescript
// src/ui/components/WorkspaceSwitcher.tsx
export function WorkspaceSwitcher() {
  const workspaces = useQuery(api.workspaces.list);
  const currentWorkspace = useCurrentWorkspace();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <WorkspaceAvatar workspace={currentWorkspace} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {workspaces?.map((ws) => (
          <DropdownMenuItem key={ws._id}>
            {ws.type === "team" && <UsersIcon />}
            {ws.type === "personal" && <UserIcon />}
            {ws.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### 4.2 Presence System

```typescript
// convex/presence.ts
export const updatePresence = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    chatId: v.optional(v.id("chats")),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        workspaceId: args.workspaceId,
        chatId: args.chatId,
        lastActiveAt: Date.now(),
      });
    } else {
      await ctx.db.insert("presence", {
        workspaceId: args.workspaceId,
        userId,
        chatId: args.chatId,
        lastActiveAt: Date.now(),
      });
    }
  },
});

export const getPresenceInChat = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const thirtySecondsAgo = Date.now() - 30_000;

    const active = await ctx.db
      .query("presence")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .filter((q) => q.gt(q.field("lastActiveAt"), thirtySecondsAgo))
      .collect();

    return Promise.all(
      active.map(async (p) => ({
        user: await ctx.db.get(p.userId),
        lastActiveAt: p.lastActiveAt,
      }))
    );
  },
});
```

#### 4.3 Invitation System (via Resend)

```typescript
// convex/invites.ts
import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";

const resend = new Resend(components.resend, {});

export const createInvite = mutation({
  args: {
    email: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const workspace = await ctx.db.get(args.workspaceId);

    const token = generateSecureToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    const inviteId = await ctx.db.insert("workspaceInvites", {
      workspaceId: args.workspaceId,
      email: args.email,
      token,
      invitedBy: userId,
      createdAt: Date.now(),
      expiresAt,
    });

    // Send email via Resend
    await resend.sendEmail(ctx, {
      from: "Camp <noreply@getcamp.ai>",
      to: args.email,
      subject: `Join ${workspace?.name} on Camp`,
      html: `
        <p>You've been invited to join ${workspace?.name} on Camp.</p>
        <a href="https://camp.so/invite/${token}">Accept Invitation</a>
      `,
    });

    return inviteId;
  },
});
```

### Effort Estimate
- **Development**: 3-4 weeks
- **Testing**: 1-2 weeks

---

## Spec 5: Rollout Plan

### Phased Approach

**Phase 1: Auth + Data Sync (Weeks 1-6)**
- Clerk integration with Google OAuth
- Convex schema and basic CRUD
- User sign-in, org/workspace auto-creation
- All new data goes to Convex
- No multiplayer features yet

**Phase 2: Multiplayer (Weeks 7-12)**
- Workspace switcher UI
- Real-time presence
- Team invitations
- Streaming to multiple viewers

### Feature Flags

```typescript
// src/core/campConfig.ts
export const campConfig = {
  // Existing
  proxyUrl: CHORUS_URL,

  // New
  convexUrl: import.meta.env.VITE_CONVEX_URL,
  clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,

  features: {
    // Phase 1
    auth: true,
    convexStorage: true,

    // Phase 2 (disabled initially)
    workspaceSwitcher: false,
    presence: false,
    invitations: false,
  },
} as const;
```

### Environment Variables

```bash
# .env.example additions
VITE_CONVEX_URL=https://your-project.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

### Rollout Checklist

- [ ] **Phase 1**
  - [ ] Convex project created
  - [ ] Clerk app configured (Google OAuth)
  - [ ] Schema deployed
  - [ ] Sign-in flow working
  - [ ] Org/workspace auto-creation working
  - [ ] Chats/messages storing in Convex
  - [ ] Internal testing (1-2 weeks)

- [ ] **Phase 2**
  - [ ] Workspace switcher UI
  - [ ] Presence indicators
  - [ ] Invitation flow
  - [ ] Real-time multi-viewer streaming
  - [ ] Beta testing (2-4 weeks)
  - [ ] Public release

---

## Critical Files Reference

### Tier 1 (Never Modify)
- `src/core/chorus/Models.ts`
- `src/core/chorus/ModelProviders/*`
- `src/core/chorus/ChatState.ts`

### Tier 2 (Pattern Reference)
- `src/core/chorus/api/MessageAPI.ts`
- `src/core/chorus/api/ChatAPI.ts`

### Tier 3 (Safe to Modify)
- `src/core/campConfig.ts`
- `src/ui/components/AppSidebar.tsx`
- `src/ui/components/Onboarding.tsx`

### New Files to Create
```
convex/
├── schema.ts           # Full schema
├── auth.ts             # User/org management
├── workspaces.ts       # Workspace CRUD
├── projects.ts         # Project CRUD
├── chats.ts            # Chat CRUD
├── messages.ts         # Message CRUD
├── streaming.ts        # AI streaming
├── tools.ts            # Tool execution
├── presence.ts         # Real-time presence
├── invites.ts          # Invitation system
└── usage.ts            # Usage tracking

src/core/camp/
├── auth/
│   ├── ClerkProvider.tsx
│   └── useAuth.ts
├── hooks/
│   ├── useWorkspaces.ts
│   ├── useChats.ts
│   └── useMessages.ts
└── ConvexProvider.tsx

src/ui/components/
├── SignIn.tsx
├── WorkspaceSwitcher.tsx
├── PresenceAvatars.tsx
└── UserMenu.tsx
```

---

## Resolved Decisions

| Question | Decision |
|----------|----------|
| Personal email domains (gmail, outlook) | Allowed - user gets personal workspace only, no team workspace |
| Workspace naming | Try Clearbit auto-detect, fallback to formatted domain. Org owner can rename in settings. |
| First user = org owner? | Yes - first user from domain becomes org owner with transfer capability later |

---

*Document Version: 2.1*
*Last Updated: December 26, 2024*
*Authors: Nabeel + Claude*
