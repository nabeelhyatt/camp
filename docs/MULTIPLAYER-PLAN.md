# Camp Multiplayer Implementation Plan

## Executive Summary

Transform Camp from a local-first SQLite app to a cloud-synced multiplayer AI workspace. **MVP-first approach**: Build a thin vertical slice to get visible multiplayer working quickly, then expand.

**Key Decisions Made:**

-   Private replies = Branch/fork model (separate private threads) - _existing `useBranchChat` + visibility flag_
-   Full presence (typing indicators, live streaming)
-   Both invite-based AND link-based sharing
-   Team size: Medium (10-50) to start
-   Team MCPs: Admin sets team default, users can override per-MCP
-   Admin model: First member is admin, can designate others
-   No existing users to migrate (clean slate)
-   Offline NOT a core promise (Convex handles gracefully)
-   Single workspace per user for now (no workspace switcher)
-   Publishing back from forks = **Summaries**, not individual messages
-   Deletion cascades to forks with warning dialog
-   Forks can chain indefinitely (fork a fork)
-   Private forks are truly private (no admin visibility)
-   Feature flags stored in Convex DB (config-based, no redeploy needed)

**Key Discovery:** The existing `useBranchChat` mutation (`MessageAPI.ts:634-758`) already implements branching with `parentChatId` and `replyToId`. Private forks = adding `visibility` field to existing infrastructure.

---

## Schema Changes Summary (Phase 1)

Fields to add to `convex/schema.ts` in Phase 1 to support Year 1 roadmap:

```typescript
// Add to ALL tables (soft deletes + audit foundation)
deletedAt: v.optional(v.number()),
deletedBy: v.optional(v.id("users")),

// Add to chats table
visibility: v.optional(v.union(v.literal("team"), v.literal("private"))),
forkFromMessageId: v.optional(v.id("messages")),
forkDepth: v.optional(v.number()),
rootChatId: v.optional(v.id("chats")),

// Add to messages table (or messageSets)
authorSnapshot: v.optional(v.object({
    userId: v.id("users"),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
})),

// New tables
featureFlags: defineTable({ ... })
auditLogs: defineTable({ ... })
```

---

## Core Value Proposition

The core experience we're building:

1. **One large single context** - Team chats with shared context & MCPs
2. **Reply into private** - Fork any team chat message into a private exploration
3. **Summaries flow back** - Shared chat summaries push into project context (already exists)
4. **Fork conversations** - Start new conversation from any point (already exists)

These are MORE important than: full Shared/Private visibility tiers, or presence indicators.

---

## MVP: Visible Multiplayer (2-3 weeks)

**Goal:** Team projects visible to everyone + profile icons + sidebar structure stubbed

### What MVP Includes:

1. **Convex for projects/chats only** - Minimal backend, just enough for sync
2. **Team visibility** - All projects in team workspace visible to all members
3. **Message attribution** - Profile icons/names next to messages (team chats only)
4. **Sidebar stub** - Full Team/Shared/Private structure visible, but Shared/Private greyed out

### What MVP Excludes (for later):

-   Private forks (Phase 2 - immediate follow-up)
-   Team MCPs/Admin (Phase 3)
-   Shared/Private visibility working (Phase 4)
-   Typing indicators/presence (Phase 5)
-   Invite/link sharing (Phase 6)

### MVP Technical Scope:

**Backend (Convex) - with proper permissions from day 1:**

-   `convex/lib/permissions.ts` - Centralized access control functions
-   `convex/projects.ts` - CRUD with workspace membership checks
-   `convex/chats.ts` - CRUD with workspace membership checks
-   `convex/messages.ts` - CRUD with chat access checks

**Frontend:**

-   Update `AppSidebar.tsx` - Full 3-tier sidebar structure (Team/Shared/Private)
    -   Team section: functional, shows team projects/chats
    -   Shared section: visible but greyed out with "Coming soon"
    -   Private section: visible but greyed out with "Coming soon"
-   Update `MultiChat.tsx` - Show author avatars on messages (team chats only)
-   Switch data layer from SQLite to Convex

### MVP Design Decisions:

-   **Author attribution**: Only on team chats (private chats implicitly "you")
    -   **Note (Phase 1 Implementation):** `MessageAttribution` component exists but integration into `MultiChat.tsx` is deferred to Phase 2 (Private Forks). Focus Phase 1 on auth/infrastructure.
-   **Permissions**: Proper access control from day 1 (check workspace membership)
-   **Sidebar**: Full structure stubbed so users see the vision, Shared/Private greyed

---

## Post-MVP Feature Order

Based on core value proposition (private forks are CORE, not "power user"):

| Priority | Feature                   | Why                                                          |
| -------- | ------------------------- | ------------------------------------------------------------ |
| 1        | **Private Forks**         | Core: reply privately to explore without polluting team chat |
| 2        | Team MCPs/Admin page      | Core: shared tools & context = team value                    |
| 3        | Shared/Private visibility | Activate the greyed sidebar sections                         |
| 4        | Full presence (typing)    | Polish the collaboration feel                                |
| 5        | Invite/link sharing       | Team growth                                                  |

---

## Current Architecture

### What Exists (Ready to Use)

-   **Convex schema** (`convex/schema.ts`): organizations, users, workspaces, workspaceMembers, projects, chats, messages, presence, mcpConfigs, invitations
-   **Clerk authentication**: Domain-based team detection (work emails → team workspace)
-   **TanStack Query layer** (`src/core/chorus/api/*.ts`): Pattern to replicate for Convex

### What's Missing

-   `visibility` field on projects (team/shared/private)
-   `projectMembers` table for shared projects
-   `shareLinks` table for link-based sharing
-   `isTyping` field on presence
-   Convex API functions (queries/mutations)
-   Sidebar restructure (Team/Shared/Private sections)

---

## Phase 1: MVP - Visible Multiplayer (Weeks 1-3)

**Goal:** Team projects visible to everyone + profile icons + full sidebar stub

### 1.1 Permissions Foundation

**New file:** `convex/lib/permissions.ts`

Centralized access control:

```typescript
// Check if user can access workspace
export async function canAccessWorkspace(ctx, workspaceId, userId);

// Check if user can access project (through workspace)
export async function canAccessProject(ctx, projectId, userId);

// Check if user can access chat (through project/workspace)
export async function canAccessChat(ctx, chatId, userId);
```

### 1.2 Convex API Functions (MVP scope)

**New files:** `convex/projects.ts`, `convex/chats.ts`, `convex/messages.ts`

MVP queries/mutations:

-   `projects.list` - List projects in user's workspace
-   `projects.create` - Create project (workspace-scoped)
-   `chats.list` - List chats in workspace
-   `chats.create` - Create chat with createdBy
-   `messages.list` - List messages with author info joined
-   `messages.create` - Create message (tracks author)

### 1.3 Frontend Data Layer Switch

Replace SQLite API calls with Convex:

**Files to modify:**

-   `src/core/chorus/api/ChatAPI.ts` → Use Convex queries/mutations
-   `src/core/chorus/api/ProjectAPI.ts` → Use Convex queries/mutations
-   `src/core/chorus/api/MessageAPI.ts` → Use Convex queries/mutations

**Approach:** Direct replacement (no abstraction layer needed since no migration)

### 1.4 Sidebar Stub (Full 3-Tier Structure)

**File:** `src/ui/components/AppSidebar.tsx`

Full sidebar structure from day 1:

```
Team
  ├── [Team Projects]        ← functional
  └── [Ungrouped team chats] ← functional

Shared                       ← greyed out, "Coming soon"
  ├── [Projects shared with me]
  └── [Projects I've shared]

Private                      ← greyed out, "Coming soon"
  ├── [My private projects]
  └── [My private chats]
```

**New components:**

-   `src/ui/components/sidebar/TeamSection.tsx` - Functional
-   `src/ui/components/sidebar/SharedSection.tsx` - Greyed placeholder
-   `src/ui/components/sidebar/PrivateSection.tsx` - Greyed placeholder

### 1.5 Message Attribution (Slack-style)

**File:** `src/ui/components/MultiChat.tsx`

-   Add author avatar + name + timestamp on user messages
-   Layout: `[Avatar] Name  12:34 PM` (horizontal, like Slack)
-   Only show attribution in team chats (private = implicitly you)
-   **Approach C**: Embed author snapshot in message + background sync job for stale data

**New:** `convex/lib/featureFlags.ts` - Config-based feature flags

```typescript
featureFlags: defineTable({
    key: v.string(),
    enabled: v.boolean(),
    workspaceId: v.optional(v.id("workspaces")), // null = global
    updatedAt: v.number(),
}).index("by_key", ["key"]);
```

**Critical Files:**

-   `convex/lib/permissions.ts` - New
-   `convex/projects.ts` - New
-   `convex/chats.ts` - New
-   `convex/messages.ts` - New
-   `src/ui/components/AppSidebar.tsx` - Major update
-   `src/ui/components/sidebar/TeamSection.tsx` - New
-   `src/ui/components/sidebar/SharedSection.tsx` - New (placeholder)
-   `src/ui/components/sidebar/PrivateSection.tsx` - New (placeholder)
-   `src/ui/components/MultiChat.tsx` - Update

---

## Phase 2: Private Forks (Weeks 4-5)

**Goal:** Core feature - reply privately to explore without polluting team chat

This is CORE functionality, not a "power user" feature. The existing `useBranchChat` mutation already handles branching - we just need to add visibility.

### 2.1 Fork Schema Update

**File:** `convex/schema.ts`

```typescript
chats: defineTable({
    // ... existing fields
    visibility: v.optional(
        v.union(
            v.literal("team"), // Visible to all workspace members
            v.literal("private"), // Only creator can see
        ),
    ),
    forkFromMessageId: v.optional(v.id("messages")), // Which message was forked from
    // parentChatId already exists for branching
});
```

### 2.2 Fork API

**File:** `convex/chats.ts` (extend)

-   `chats.createPrivateFork` - Fork team chat to private (sets `visibility: "private"`)
-   `chats.publishSummary` - Publish a **summary** (not individual messages) back to team chat

### 2.3 Fork Behavior Decisions

-   **Fork chains**: Allowed (fork a fork of a fork)
-   **Deletion**: Deleting parent chat cascades to forks with warning dialog: "This will delete X private forks from other team members"
-   **Publishing back**: Creates a summary message in parent chat, NOT individual messages
    -   Summary appears as "Sarah shared insights from her exploration: [summary text]"
    -   Link to view the full fork thread (if user has access)
-   **Private forks truly private**: No admin visibility into others' private forks

### 2.4 Fork UI

**File:** `src/ui/components/MultiChat.tsx`

-   Leverage existing reply button, add "Reply privately" option
-   Show fork indicator: "Private exploration from [Team Chat Name]"

**New components:**

-   `src/ui/components/ForkIndicator.tsx` - Banner showing this is a private fork
-   `src/ui/components/PublishSummaryDialog.tsx` - Write summary to share back (NOT message picker)

### 2.5 Private Fork in Sidebar

Private forks should appear in the "Private" section:

-   Show private forks under Private section
-   Visual indicator linking back to parent chat (e.g., "↩ from Project Alpha")
-   Clicking indicator navigates to parent chat context

**Critical Files:**

-   `convex/schema.ts` - Add visibility, forkFromMessageId to chats
-   `convex/chats.ts` - Fork mutations (extend `createPrivateFork`, `publishSummary`)
-   `src/ui/components/MultiChat.tsx` - Fork button, fork indicator
-   `src/ui/components/ForkIndicator.tsx` - New
-   `src/ui/components/PublishSummaryDialog.tsx` - New (summary input, not message picker)
-   `src/ui/components/sidebar/PrivateSection.tsx` - Activate for private forks

---

## Phase 3: Team MCPs & Admin Page (Weeks 6-8)

**Goal:** Shared team tools and context, admin visibility

### 3.0 Admin Model

-   **First member becomes admin** (set during `syncUser` in `convex/auth.ts`)
-   Admins can designate other admins
-   Admins can: manage MCPs, invite members, modify workspace settings
-   Non-admins can: use team MCPs, view member list, create projects/chats

### 3.1 Team Admin Page

**New route:** `/team` or `/workspace/admin`

**New components:**

-   `src/ui/components/admin/TeamAdminPage.tsx` - Main admin view
-   `src/ui/components/admin/TeamMembersList.tsx` - Who's on the team + roles
-   `src/ui/components/admin/TeamMCPList.tsx` - Shared MCPs
-   `src/ui/components/admin/TeamContext.tsx` - Shared team instructions

### 3.2 MCP Schema Update

**File:** `convex/schema.ts`

```typescript
mcpConfigs: defineTable({
    // ... existing fields
    scope: v.union(v.literal("workspace"), v.literal("project")),
    // Secrets: admin sets team default, users can override
    teamSecrets: v.optional(v.any()), // Encrypted team-level secrets
});

// For per-project MCP toggles
projectMcpOverrides: defineTable({
    projectId: v.id("projects"),
    mcpConfigId: v.id("mcpConfigs"),
    enabled: v.boolean(),
});

// For per-user MCP secret overrides
userMcpSecrets: defineTable({
    userId: v.id("users"),
    mcpConfigId: v.id("mcpConfigs"),
    encryptedSecrets: v.any(), // User's personal API keys for this MCP
});
```

### 3.3 MCP Credentials Model

-   **Team default**: Admin sets credentials that all members use
-   **User override**: Individual users can provide their own credentials
-   **Resolution order**: User override → Team default → Not configured
-   UI shows "Using team credentials" or "Using your credentials"

### 3.4 MCP Inheritance Logic

**New file:** `convex/mcpConfigs.ts`

-   `mcpConfigs.listForWorkspace` - All team MCPs
-   `mcpConfigs.listForProject` - Team MCPs with project overrides applied
-   `mcpConfigs.toggleForProject` - Enable/disable MCP for specific project
-   `mcpConfigs.setUserSecrets` - User provides their own credentials

### 3.5 Project MCP UI

**File:** `src/ui/components/ProjectView.tsx`

-   Add "Tools" or "MCPs" section
-   Show inherited team MCPs with toggle switches
-   Visual indicator for "inherited from team"
-   "Use my credentials" toggle per MCP

**Critical Files:**

-   `convex/schema.ts` - Add scope, projectMcpOverrides, userMcpSecrets
-   `convex/mcpConfigs.ts` - New
-   `src/ui/components/admin/*.tsx` - New
-   `src/ui/components/ProjectView.tsx` - Add MCP section
-   `src/ui/App.tsx` - Add /team route

---

## Phase 4: Shared/Private Visibility (Weeks 9-12)

**Goal:** Activate the greyed sidebar sections - full visibility tiers

### 4.1 Schema Updates

**File:** `convex/schema.ts`

Add visibility to projects:

```typescript
projects: defineTable({
    // ... existing fields
    visibility: v.union(
        v.literal("team"), // All workspace members
        v.literal("shared"), // Explicitly invited users
        v.literal("private"), // Creator only
    ),
});

// For shared project access
projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
    invitedBy: v.id("users"),
    joinedAt: v.number(),
});

// For link-based sharing
shareLinks: defineTable({
    projectId: v.id("projects"),
    token: v.string(),
    permission: v.union(v.literal("view"), v.literal("edit")),
    createdBy: v.id("users"),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
});
```

### 4.2 Activate Sidebar Sections

**File:** `src/ui/components/sidebar/SharedSection.tsx`

-   Remove "Coming soon" placeholder
-   Wire up to projectMembers queries
-   Show projects shared with me / I've shared

**File:** `src/ui/components/sidebar/PrivateSection.tsx`

-   Remove "Coming soon" placeholder (partially activated in Phase 2)
-   Show all private projects and chats
-   Include private forks with parent chat indicator

### 4.3 New Components

-   `src/ui/components/sidebar/VisibilityBadge.tsx` - Lock/users icons
-   `src/ui/components/VisibilityPicker.tsx` - Set project visibility
-   `src/ui/components/sharing/ShareDialog.tsx` - Invite UI (basic)

**Critical Files:**

-   `convex/schema.ts` - Add visibility, projectMembers, shareLinks
-   `convex/lib/permissions.ts` - Update for visibility checks
-   `src/ui/components/sidebar/SharedSection.tsx` - Activate
-   `src/ui/components/sidebar/PrivateSection.tsx` - Full activation
-   `src/ui/components/ProjectView.tsx` - Add visibility picker

---

## Phase 5: Full Presence & Typing (Weeks 13-15)

**Goal:** Typing indicators, live message streaming visible to all

### 5.1 Presence Schema Update

**File:** `convex/schema.ts`

```typescript
presence: defineTable({
    // ... existing fields
    isTyping: v.boolean(),
    lastActivity: v.optional(v.string()), // "viewing" | "composing"
});
```

### 5.2 Presence API

**New file:** `convex/presence.ts`

-   `presence.heartbeat` - Update presence (10s interval)
-   `presence.setTyping` - Toggle typing indicator
-   `presence.getChatPresence` - Who's in this chat
-   Scheduled function to cleanup stale presence (>60s)

### 5.3 Typing Indicator UI

**New components:**

-   `src/ui/components/presence/PresenceAvatars.tsx` - Users in chat header
-   `src/ui/components/presence/TypingIndicator.tsx` - "[Name] is typing..."
-   `src/ui/components/presence/OnlineDot.tsx` - Green dot on avatars

### 5.4 Live Message Streaming

Update message streaming to:

1. Create message with `status: "streaming"` immediately
2. All users subscribed to chat see streaming in real-time
3. Use Convex subscriptions for automatic updates

**File:** `src/ui/components/ChatInput.tsx`

-   Send typing heartbeat on input change
-   Clear typing on send/blur

**Critical Files:**

-   `convex/schema.ts` - Add isTyping to presence
-   `convex/presence.ts` - New
-   `src/ui/components/ChatInput.tsx` - Typing heartbeats
-   `src/ui/components/MultiChat.tsx` - Show typing indicator, presence avatars
-   `src/ui/components/presence/*.tsx` - New

---

## Phase 6: Invitations & Link Sharing (Weeks 16-18)

**Goal:** Invite people by email, generate shareable links

### 6.1 Email Invitations

**File:** `convex/invitations.ts` (extend existing)

-   `invitations.inviteToProject` - Send email invite
-   `invitations.acceptProjectInvitation` - Accept via token
-   `invitations.listPending` - Show pending invites

### 6.2 Link-Based Sharing

**New file:** `convex/shareLinks.ts`

-   `shareLinks.create` - Generate unique token URL
-   `shareLinks.accept` - Join project via link
-   `shareLinks.revoke` - Disable link

### 6.3 Share Settings UI

Enhance `src/ui/components/sharing/ShareDialog.tsx` (from Phase 4):

-   Member list with roles + remove option
-   Email invite input with send button
-   Link sharing toggle + copy button
-   Permission dropdown (view/edit)

**Critical Files:**

-   `convex/invitations.ts` - Extend
-   `convex/shareLinks.ts` - New
-   `src/ui/components/sharing/ShareDialog.tsx` - Enhance

---

## Permission Model

### Visibility Levels

| Level   | Who Can See             | Who Can Edit                        |
| ------- | ----------------------- | ----------------------------------- |
| team    | All workspace members   | All workspace members               |
| shared  | Creator + invited users | Based on role (owner/editor/viewer) |
| private | Creator only            | Creator only                        |

### Access Check Logic

```
1. Is user creator? → Full access
2. Is visibility="team" AND user in workspace? → Full access
3. Is user in projectMembers? → Access based on role
4. Does user have valid shareLink? → Access based on link permission
5. Otherwise → No access
```

---

## Risk Areas & Mitigations

| Risk                                          | Mitigation                                   |
| --------------------------------------------- | -------------------------------------------- |
| Breaking existing chat functionality          | Feature flag for instant rollback            |
| Performance with many real-time subscriptions | Efficient query design; pagination           |
| Convex rate limits with presence heartbeats   | Batch heartbeats; longer intervals when idle |
| Complex permission logic bugs                 | Comprehensive access check functions         |

---

## Implementation Order

**Critical Path:**

1. Phase 1.1-1.3 (Convex API) - Foundation for everything
2. Phase 1.4 (Sidebar stub) - Visible structure from day 1
3. Phase 2 (Private Forks) - Core differentiating feature
4. Phase 3 (Team MCPs) - Core team value

**Parallelizable:**

-   Phase 4 (Visibility) and Phase 5 (Presence) can run in parallel
-   Phase 6 (Invitations) can start after Phase 4

---

## File Summary by Phase

### Phase 1: MVP (Weeks 1-3)

**New Convex Files:**

-   `convex/lib/permissions.ts` - Access control
-   `convex/projects.ts` - Project CRUD
-   `convex/chats.ts` - Chat CRUD
-   `convex/messages.ts` - Message CRUD

**New Frontend Files:**

-   `src/ui/components/sidebar/TeamSection.tsx` - Functional
-   `src/ui/components/sidebar/SharedSection.tsx` - Greyed placeholder
-   `src/ui/components/sidebar/PrivateSection.tsx` - Greyed placeholder

**Modified Files:**

-   `src/ui/components/AppSidebar.tsx` - Full 3-tier sidebar stub
-   `src/ui/components/MultiChat.tsx` - Author avatars
-   `src/core/chorus/api/*.ts` - Switch to Convex

### Phase 2: Private Forks (Weeks 4-5)

**New Frontend Files:**

-   `src/ui/components/ForkButton.tsx` - "Reply privately"
-   `src/ui/components/ForkIndicator.tsx` - Fork banner
-   `src/ui/components/PublishToParentDialog.tsx`

**Modified Files:**

-   `convex/schema.ts` - Add forkType, forkFromMessageId, isPrivateFork
-   `convex/chats.ts` - Fork mutations
-   `src/ui/components/sidebar/PrivateSection.tsx` - Activate for forks

### Phase 3: Team MCPs (Weeks 6-8)

**New Convex Files:**

-   `convex/mcpConfigs.ts`

**New Frontend Files:**

-   `src/ui/components/admin/TeamAdminPage.tsx`
-   `src/ui/components/admin/TeamMembersList.tsx`
-   `src/ui/components/admin/TeamMCPList.tsx`
-   `src/ui/components/admin/TeamContext.tsx`

**Modified Files:**

-   `convex/schema.ts` - Add projectMcpOverrides
-   `src/ui/components/ProjectView.tsx` - MCP section
-   `src/ui/App.tsx` - /team route

### Phase 4: Shared/Private Visibility (Weeks 9-12)

**New Frontend Files:**

-   `src/ui/components/sidebar/VisibilityBadge.tsx`
-   `src/ui/components/VisibilityPicker.tsx`
-   `src/ui/components/sharing/ShareDialog.tsx`

**Modified Files:**

-   `convex/schema.ts` - Add visibility, projectMembers, shareLinks
-   `src/ui/components/sidebar/SharedSection.tsx` - Activate
-   `src/ui/components/sidebar/PrivateSection.tsx` - Full activation

### Phase 5: Presence & Typing (Weeks 13-15)

**New Convex Files:**

-   `convex/presence.ts`

**New Frontend Files:**

-   `src/ui/components/presence/PresenceAvatars.tsx`
-   `src/ui/components/presence/TypingIndicator.tsx`
-   `src/ui/components/presence/OnlineDot.tsx`

**Modified Files:**

-   `convex/schema.ts` - Add isTyping to presence
-   `src/ui/components/ChatInput.tsx` - Typing heartbeats

### Phase 6: Invitations (Weeks 16-18)

**New Convex Files:**

-   `convex/shareLinks.ts`

**Modified Files:**

-   `convex/invitations.ts` - Project invitations
-   `src/ui/components/sharing/ShareDialog.tsx` - Enhance

---

## One-Year Roadmap (Long-Term Vision)

### Q1: Foundation (Months 1-4) - Phases 1-6

_Covered above - core multiplayer functionality_

| Month   | Milestone                                        |
| ------- | ------------------------------------------------ |
| Month 1 | MVP: Team sync, sidebar stub, author attribution |
| Month 2 | Private Forks: Reply privately from team chats   |
| Month 3 | Team MCPs: Shared tools & admin page             |
| Month 4 | Visibility + Presence + Invitations complete     |

**Exit Criteria:** Teams can collaborate in real-time with shared context, private exploration, and team tools.

---

### Q2: Enhanced Collaboration (Months 5-7)

**Goal:** Make team collaboration feel native and seamless

| Feature                  | Description                                       | Value                   |
| ------------------------ | ------------------------------------------------- | ----------------------- |
| **@Mentions**            | Tag teammates in messages, trigger notifications  | Directed communication  |
| **Notifications System** | In-app + push notifications for mentions, replies | Stay informed           |
| **Activity Feed**        | "What happened while I was away" view             | Team awareness          |
| **Chat Search**          | Full-text search across all team chats            | Find past conversations |
| **Reactions**            | Emoji reactions on messages (👍 ✅ 🎉)            | Quick acknowledgment    |
| **Pinned Messages**      | Pin important messages to chat/project            | Highlight key info      |
| **Favorites/Bookmarks**  | Save messages for later reference                 | Personal organization   |

**Technical Scope:**

-   `convex/notifications.ts` - Notification storage and delivery
-   `convex/search.ts` - Full-text search with Convex
-   Push notification integration (web + native)
-   Activity feed UI component

---

### Q3: Team Intelligence (Months 8-10)

**Goal:** AI that understands your team's context and history

| Feature                   | Description                                     | Value                |
| ------------------------- | ----------------------------------------------- | -------------------- |
| **Team Knowledge Base**   | Searchable repository of all team conversations | Institutional memory |
| **AI Context Awareness**  | AI can reference past team chats when relevant  | Smarter responses    |
| **Smart Summaries**       | Auto-generate summaries of long chats/projects  | Quick catch-up       |
| **Suggested Actions**     | AI suggests next steps based on conversation    | Productivity boost   |
| **Cross-Chat References** | Link related conversations together             | Connected knowledge  |
| **Team Prompts Library**  | Shared prompt templates for common tasks        | Consistency          |

**Technical Scope:**

-   Vector embeddings for semantic search (Convex + vector store)
-   Background jobs for summary generation
-   Prompt template management system
-   Cross-reference detection

#### Team Context Repository (Critical Foundation)

**Vision:** Camp should function like NotebookLM, Perplexity Projects, or Cursor's codebase awareness - a large, persistent repository of team context (PDFs, documents, images, files) that can be referenced across all team conversations.

**Why This Matters:**
- Teams accumulate knowledge in documents, specs, research papers, images
- Currently, each chat starts fresh - context must be re-uploaded
- With a shared context repository, any team member can start a chat that "knows" the team's accumulated knowledge
- This is the core multiplayer differentiator: shared context, not just shared chats

**Implementation Blocker - GitHub Issue #7:**
Currently, large file attachments (PDFs, images) are embedded as base64 in API requests, causing timeouts with rich context. Anthropic's Files API allows:
- Upload files once, reference by `file_id` in subsequent requests
- Team-wide file storage with Convex
- Much larger context windows without request size limits

See: https://github.com/nabeelhyatt/camp/issues/7

**Phased Approach:**
1. **Q1 (Phase 1):** Implement Anthropic Files API for individual chats (fixes timeout bug)
2. **Q2:** Add team file storage in Convex with workspace-scoped access
3. **Q3:** Build "Team Context" UI - browse/search/manage team files
4. **Q3:** Enable "include team context" toggle on new chats

**Deferred Improvements (from Phase 1 review):**

-   **Personal email domains list**: Currently hardcoded in `convex/auth.ts`. Consider using a library like `is-disposable-email` or making configurable via Convex table for easier maintenance.
-   **Audit logging integration**: `convex/lib/audit.ts` exists with `logAudit()` helper but is not yet called from mutations. Wire up audit calls to critical mutations when building audit log UI.

---

### Q4: Enterprise & Scale (Months 11-12)

**Goal:** Ready for larger organizations and compliance requirements

| Feature                 | Description                             | Value                  |
| ----------------------- | --------------------------------------- | ---------------------- |
| **SSO/SAML**            | Enterprise single sign-on               | Security compliance    |
| **Advanced Roles**      | Custom roles beyond owner/editor/viewer | Flexible permissions   |
| **Audit Logs**          | Track all actions for compliance        | Enterprise requirement |
| **Usage Analytics**     | Dashboard showing team usage patterns   | Admin insights         |
| **Data Export**         | Export all team data (GDPR compliance)  | Data portability       |
| **API Access**          | Public API for integrations             | Extensibility          |
| **Workspace Templates** | Pre-configured workspace setups         | Faster onboarding      |
| **Multi-Workspace**     | Users belong to multiple organizations  | Consultants, agencies  |

**Technical Scope:**

-   Auth0/Okta SSO integration
-   Comprehensive audit logging system
-   Analytics dashboard with charts
-   REST/GraphQL API layer
-   Data export pipeline

---

### Future Considerations (Year 2+)

These are potential directions based on how the product evolves:

**Integrations & Ecosystem:**

-   Slack/Discord integration (bi-directional sync)
-   GitHub/GitLab integration (link PRs to chats)
-   Notion/Confluence integration (sync docs)
-   Calendar integration (meeting context)
-   Zapier/Make webhooks

**Advanced AI Features:**

-   Multi-model orchestration per team
-   Custom fine-tuned models per organization
-   AI agents that can act on behalf of team
-   Voice/video chat with AI transcription

**Collaboration Modes:**

-   Real-time co-editing of prompts
-   Whiteboard/canvas for visual collaboration
-   Video/voice chat integration
-   Screen sharing with AI annotation

**Platform Expansion:**

-   Mobile apps (iOS/Android)
-   Web version (beyond desktop app)
-   Browser extension for quick access
-   VS Code / IDE integration

---

## Roadmap Summary

```
Year 1 Timeline:

Q1 (M1-4)     Q2 (M5-7)        Q3 (M8-10)       Q4 (M11-12)
─────────────────────────────────────────────────────────────
Foundation    Enhanced         Team             Enterprise
              Collaboration    Intelligence     & Scale
─────────────────────────────────────────────────────────────
• Team sync   • @Mentions      • Knowledge      • SSO/SAML
• Private     • Notifications    base          • Audit logs
  forks       • Activity       • AI context    • Analytics
• Team MCPs     feed           • Smart         • API access
• Visibility  • Search           summaries    • Data export
• Presence    • Reactions      • Team prompts
• Invites     • Pins/bookmarks • Cross-refs
─────────────────────────────────────────────────────────────
        Core Product                    Growth & Enterprise
```

**Success Metrics by Quarter:**

| Quarter | Key Metrics                                                |
| ------- | ---------------------------------------------------------- |
| Q1      | Teams actively using multiplayer (>3 people collaborating) |
| Q2      | Daily active users returning, notification engagement      |
| Q3      | Search usage, knowledge base queries, AI context hits      |
| Q4      | Enterprise pilot customers, API integrations created       |

---

## Architectural Decisions: Plan Now, Build Later

These patterns should be established in Phase 1 even though the full features come later:

### 1. Soft Deletes (Add Now)

**Why:** Hard to retrofit; needed for audit logs (Q4) and undo functionality

```typescript
// Add to ALL entities from Phase 1:
deletedAt: v.optional(v.number()),
deletedBy: v.optional(v.id("users")),
```

**Impact:** All queries need `deletedAt: undefined` filter. Small cost now, huge pain to add later.

### 2. Audit Trail Foundation (Add Now)

**Why:** Enterprise requirement (Q4), but pattern must exist from day 1

```typescript
// New table in Phase 1:
auditLogs: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    action: v.string(), // "chat.create", "message.send", "project.delete"
    entityType: v.string(), // "chat", "message", "project"
    entityId: v.string(),
    metadata: v.optional(v.any()), // Additional context
    timestamp: v.number(),
})
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_entity", ["entityType", "entityId"]);
```

**Impact:** Call `logAudit()` in every mutation. Don't display UI yet, just capture data.

### 3. Message Author Snapshot Pattern (Add Now)

**Why:** Performance + data integrity for Q2-Q3 features

```typescript
messages: defineTable({
    // ... existing
    authorSnapshot: v.object({
        userId: v.id("users"),
        displayName: v.string(),
        avatarUrl: v.optional(v.string()),
    }),
});
```

**Impact:** No joins for message display. Background job syncs stale snapshots.

### 4. Fork Provenance Chain (Add Now)

**Why:** Needed for fork visualization (Phase 2), deletion cascades, Q3 cross-references

```typescript
chats: defineTable({
    // ... existing
    forkDepth: v.optional(v.number()), // 0 = root, 1 = first fork, etc.
    rootChatId: v.optional(v.id("chats")), // Ultimate ancestor
});
```

**Impact:** Enables "show all forks of this chat" and prevents orphaned chains.

### 5. Presence Rate Limiting (Add Now)

**Why:** Convex rate limits; presence (Phase 5) will hit them without design

-   Heartbeat: Every 30s (not 10s)
-   Typing: Debounce 500ms, auto-clear after 5s
-   Batch presence updates (not per-keystroke)

### 6. Feature Flags from Day 1

**Why:** Safe rollouts, A/B testing foundation

```typescript
featureFlags: defineTable({
    key: v.string(),
    enabled: v.boolean(),
    workspaceId: v.optional(v.id("workspaces")),
    rolloutPercentage: v.optional(v.number()), // 0-100 for gradual rollout
    updatedAt: v.number(),
}).index("by_key", ["key"]);
```

### 7. Upstream Compatibility (Tier Strategy)

**Constraint:** Camp is a fork of Chorus. Per `UPSTREAM-SYNC.md`:

-   **Tier 1** (never modify): Model providers, MCP, ChatState - route around these
-   **Tier 2** (careful): MultiChat, ManageModelsBox - minimal changes, document
-   **Tier 3** (safe): campConfig.ts, Settings, new files - all Camp customization here

**Phase 1 Strategy:**

-   New files for multiplayer (`convex/*`, `sidebar/*.tsx`) = Tier 3, safe
-   `AppSidebar.tsx` = Tier 2, document changes clearly
-   `MultiChat.tsx` = Tier 2, keep changes surgical (author attribution only)

---

## Convex Quick Wins (Build in Phase 1)

Convex makes these trivially easy - include them early:

| Feature            | Convex Capability       | Phase             |
| ------------------ | ----------------------- | ----------------- |
| Real-time sync     | Built-in subscriptions  | 1                 |
| Optimistic updates | Built-in with mutations | 1                 |
| File storage       | `ctx.storage.store()`   | 1                 |
| Scheduled cleanup  | `scheduler.runAfter()`  | 1                 |
| Full-text search   | Convex search indexes   | 2 (add index now) |
| Rate limiting      | `rateLimiter` helper    | 1                 |

**Search Index (add in Phase 1 even though search is Q2):**

```typescript
messages: defineTable({
    // ... existing
}).searchIndex("search_content", {
    searchField: "content", // Need to denormalize from messageParts
    filterFields: ["chatId", "workspaceId"],
});
```
