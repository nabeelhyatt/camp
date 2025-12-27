# PRD: Google Authentication for Camp

## Overview

Add Google authentication to Camp using **Clerk** for auth and **Convex** for cloud data sync. This enables users to sign in with Google and sync their data across devices.

## Current State

Camp operates as a **local-only application**:
- Device ID generated on first launch
- All data stored in local SQLite
- No user accounts or cloud sync
- Chorus backend used only for model API proxying and billing

## Goals

1. **User Authentication**: Require sign-in with Google (no anonymous mode)
2. **Cross-Device Sync**: Sync chats, settings, and API-based configs across devices
3. **Multiplayer Foundation**: User accounts enable future team/collaboration features

## Non-Goals

- Anonymous/offline-first mode (sign-in required)
- Pro plan or billing integration (not for now)
- Account deletion / GDPR compliance (out of scope)
- Multiple OAuth providers (Google only for MVP)

---

## Technical Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **Auth** | Clerk | Google OAuth, session management |
| **Cloud Database** | Convex | Real-time sync, user data, chat history |
| **Existing Backend** | Chorus | Model API proxying, billing (unchanged) |
| **Local Cache** | SQLite (Tauri) | Offline reads, fast access |

### Why Clerk + Convex?

1. **First-class integration**: Convex has built-in `ConvexProviderWithClerk`
2. **Real-time sync**: Convex is reactive; changes propagate automatically
3. **TypeScript end-to-end**: Type-safe from React to database
4. **Generous free tiers**: Both have substantial free usage
5. **Zero backend code**: Serverless functions in Convex

---

## Data Sync Strategy

### What Syncs to Convex

| Data | Syncs | Notes |
|------|-------|-------|
| User profile | Yes | Email, name, avatar from Clerk |
| API keys | Yes | **Encrypted** before storage |
| Chat history | Yes | Messages, attachments metadata |
| Model preferences | Yes | Default models, configurations |
| MCP servers (API-based) | Yes | Remote/hosted MCP endpoints |
| Projects | Yes | Project metadata and membership |

### What Stays Local (SQLite)

| Data | Reason |
|------|--------|
| MCP servers (local paths) | Device-specific paths won't work across machines |
| UI preferences (fonts) | Personal device preference |
| Cached responses | Performance optimization |

---

## Architecture

### High-Level Flow

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────────┐
│  Camp Desktop   │────▶│   Clerk     │────▶│  Google OAuth   │
│  (Tauri/React)  │◀────│   (Auth)    │◀────│                 │
└─────────────────┘     └─────────────┘     └─────────────────┘
         │                     │
         │                     │ JWT Token
         ▼                     ▼
┌─────────────────┐     ┌─────────────────┐
│  Local SQLite   │◀───▶│    Convex       │
│  (offline cache)│     │  (cloud sync)   │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Chorus Backend │
│  (model proxy)  │
└─────────────────┘
```

### Authentication Flow

1. User opens Camp → Sign-in screen (no skip option)
2. User clicks "Sign in with Google"
3. Clerk opens Google OAuth in system browser
4. Google authenticates → redirects to `camp://auth/callback`
5. Clerk creates session, returns JWT
6. Camp stores session in Tauri secure storage
7. Convex client initialized with Clerk token
8. User data synced from Convex → local SQLite cache
9. App ready to use

### Convex Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users (synced from Clerk via webhook)
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),

  // User settings (API keys encrypted client-side)
  userSettings: defineTable({
    userId: v.id("users"),
    apiKeys: v.string(), // JSON, encrypted
    modelPreferences: v.optional(v.string()), // JSON
    mcpServers: v.optional(v.string()), // JSON, API-based only
  }).index("by_user", ["userId"]),

  // Projects
  projects: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  // Chats
  chats: defineTable({
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    title: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"]),

  // Messages
  messages: defineTable({
    chatId: v.id("chats"),
    role: v.string(), // "user" | "assistant" | "system"
    content: v.string(),
    model: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_chat", ["chatId"]),
});
```

### React Integration

```typescript
// src/ui/providers/ConvexProvider.tsx
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

export function ConvexClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

### Deep Link Handling (Tauri)

Extend existing deep link handler in `src-tauri`:

```rust
// Handle auth callback
if url.starts_with("camp://auth/callback") {
    // Extract token, complete Clerk sign-in
}
```

---

## User Experience

### Sign-In Screen

```
┌─────────────────────────────────────┐
│                                     │
│            [Camp Logo]              │
│                                     │
│     Welcome to Camp                 │
│     AI chat for teams               │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🔵 Sign in with Google     │    │
│  └─────────────────────────────┘    │
│                                     │
│     By signing in, you agree to     │
│     our Terms and Privacy Policy    │
│                                     │
└─────────────────────────────────────┘
```

- **No "skip" or "continue without account"** - sign-in is required
- Single button for Google OAuth
- Clean, minimal design

### Post-Sign-In

1. Brief loading state while syncing
2. If existing user: Load their chats and settings
3. If new user: Show quick onboarding for API keys (or skip if using Camp's keys)
4. Land on main chat interface

### Sidebar Changes

```
┌──────────────────┐
│ [+] New Chat     │
│                  │
│ Recent Chats     │
│ ├─ Chat 1        │
│ ├─ Chat 2        │
│ └─ Chat 3        │
│                  │
│ Projects         │
│ ├─ Project A     │
│ └─ Project B     │
│                  │
│ ──────────────── │
│ [Avatar] Nabeel  │  ← User profile
│ Settings | Logout│
└──────────────────┘
```

---

## Implementation Phases

### Phase 1: Auth + User Profile (Week 1)
- [ ] Set up Clerk project with Google OAuth
- [ ] Set up Convex project
- [ ] Create Clerk → Convex webhook for user sync
- [ ] Build sign-in UI (replace current onboarding)
- [ ] Implement deep link callback handler
- [ ] Store session in Tauri secure storage
- [ ] Display user profile in sidebar

### Phase 2: Settings Sync (Week 2)
- [ ] Create Convex schema for userSettings
- [ ] Implement client-side encryption for API keys
- [ ] Sync settings on sign-in
- [ ] Bidirectional sync (local ↔ Convex)
- [ ] Handle offline → online sync

### Phase 3: Chat Sync (Week 3)
- [ ] Create Convex schema for chats/messages
- [ ] Migrate local chat creation to Convex
- [ ] Implement incremental sync
- [ ] Handle large chat histories (pagination)
- [ ] Sync attachments metadata (not files)

### Phase 4: Polish (Week 4)
- [ ] Loading states and error handling
- [ ] Sync status indicator
- [ ] Conflict resolution edge cases
- [ ] Performance optimization
- [ ] Testing across devices

---

## Environment Variables

```bash
# .env.local (development)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_CONVEX_URL=https://your-project.convex.cloud

# Convex Dashboard
CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-instance.clerk.accounts.dev
```

---

## Security Considerations

1. **API Key Encryption**: Encrypt API keys client-side before storing in Convex
2. **JWT Validation**: Convex validates Clerk JWTs server-side
3. **Secure Storage**: Session tokens stored in Tauri Stronghold
4. **HTTPS Only**: All Convex/Clerk communication over HTTPS

---

## Success Metrics

- **Sign-in completion rate**: % of users who complete Google sign-in
- **Multi-device usage**: % of users accessing from 2+ devices
- **Sync reliability**: Error rate in sync operations
- **Time to first chat**: Latency from sign-in to first message

---

## Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Clerk vs Supabase? | **Clerk** (better UX, native Convex integration) |
| Keep anonymous mode? | **No** - sign-in required (multiplayer-first) |
| Build new backend? | **No** - use Convex + keep Chorus for proxy |
| What syncs? | API keys, chats, model prefs, API-based MCP configs |
| Pro plan integration? | **Not now** |
| Account deletion? | **Out of scope** |

---

## Convex Features to Leverage

### Current Architecture Analysis

The existing Camp chat system is **fundamentally single-user**:
- No `user_id` fields anywhere in the schema
- No real-time sync mechanisms
- No multi-user awareness
- All data isolated to local SQLite per device

**Key finding**: Multiplayer will require significant changes regardless. This creates an opportunity to adopt Convex's purpose-built primitives rather than retrofitting the local architecture.

### Feature Adoption by Phase

#### Phase 1: Auth (Use Now)
| Feature | Purpose |
|---------|---------|
| **Clerk Integration** | Built-in `ConvexProviderWithClerk` |
| **Real-time Subscriptions** | Core Convex - queries auto-update |

#### Phase 2-3: Sync + Multiplayer (Evaluate)
| Feature | Purpose | Recommendation |
|---------|---------|----------------|
| **Convex Agent Component** | Thread/message management, streaming | **Strongly consider** - may replace custom chat layer |
| **Presence Component** | Who's online, typing indicators | **Use** when multiplayer ships |
| **File Storage** | Attachment uploads | **Use** - simpler than S3 |

#### Future (Nice-to-Have)
| Feature | Purpose |
|---------|---------|
| **RAG Component** | Semantic search across chats |
| **Scheduled Functions** | Background jobs, cleanup |
| **Rate Limiter Component** | Per-user rate limiting |

### Convex Agent Component: Deep Dive

The [Convex Agent Component](https://github.com/get-convex/agent) is highly relevant for Camp:

**What it provides:**
- **Threads**: Built-in chat containers with ordering, pagination
- **Messages**: Structured message storage with tool calls support
- **Streaming over WebSockets**: Real-time token streaming (not HTTP streaming)
- **Multi-agent support**: Multiple LLMs in same thread
- **Usage tracking**: Per-user, per-model attribution
- **Rate limiting**: Built-in via Rate Limiter Component
- **File handling**: Automatic storage with ref-counting

**Comparison to current Chorus architecture:**

| Aspect | Current (Chorus/SQLite) | Convex Agent |
|--------|-------------------------|--------------|
| Storage | Local SQLite | Cloud (Convex) |
| Real-time | None | WebSocket subscriptions |
| Multi-user | ❌ Not supported | ✅ Built-in |
| Streaming | HTTP streaming to local DB | WebSocket deltas |
| Message structure | `message_sets` + `message_parts` | `threads` + `messages` |
| Tool calls | Custom implementation | Built-in support |
| User attribution | None | Per-message user_id |

### Migration Recommendation

**Option A: Incremental Migration (Lower risk, more work)**
1. Keep local SQLite for reads (offline support)
2. Add Convex as sync layer
3. Dual-write: local + Convex
4. Eventually deprecate local-only writes

**Option B: Full Migration to Convex Agent (Higher risk, cleaner architecture)**
1. Adopt Convex Agent Component for all chat/message handling
2. Use Convex as source of truth
3. Local SQLite becomes read cache only
4. Leverage all Agent features (streaming, presence, etc.)

**Recommendation: Option B** for these reasons:
1. Current architecture has no user attribution - needs rewrite anyway
2. Multiplayer requires real-time sync - Convex provides this natively
3. Agent Component solves problems we'd otherwise build ourselves
4. Cleaner long-term architecture

**Risk mitigation:**
- Spike on Agent Component before committing (1-2 days)
- Keep Chorus patterns for model proxying (proven, stable)
- Migrate incrementally: new chats on Convex, read-only access to old SQLite chats

---

## Multiplayer Architecture

### What Changes for Multiplayer

| Component | Current | Multiplayer |
|-----------|---------|-------------|
| Chat ownership | None (single user) | `userId` + `workspaceId` |
| Message attribution | None | `userId` per message |
| Real-time updates | None | Convex subscriptions |
| Presence | None | Convex Presence Component |
| Access control | None (local only) | Convex + workspace membership |

### Proposed Multiplayer Schema

```typescript
// convex/schema.ts (multiplayer-ready)
export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),

  // Workspaces (teams)
  workspaces: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  // Workspace membership
  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.string(), // "owner" | "admin" | "member"
    joinedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"]),

  // Projects (within workspaces)
  projects: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  // Chats (owned by user, optionally in workspace)
  chats: defineTable({
    ownerId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    projectId: v.optional(v.id("projects")),
    title: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_workspace", ["workspaceId"]),

  // Messages (with user attribution)
  messages: defineTable({
    chatId: v.id("chats"),
    userId: v.id("users"), // Who sent this
    role: v.string(),
    content: v.string(),
    model: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_chat", ["chatId"]),

  // Presence (who's viewing what)
  presence: defineTable({
    oderId: v.id("users"),
    chatId: v.optional(v.id("chats")),
    lastSeen: v.number(),
    status: v.string(), // "viewing" | "typing"
  })
    .index("by_chat", ["chatId"])
    .index("by_user", ["userId"]),
});
```

### Multiplayer UX Features

1. **Presence indicators**: See who's in a chat
2. **Typing indicators**: "Nabeel is typing..."
3. **Live message updates**: Messages appear in real-time
4. **User avatars on messages**: Know who said what
5. **Workspace switcher**: Switch between teams

---

## References

- [Convex + Clerk Integration](https://docs.convex.dev/auth/clerk)
- [Clerk React SDK](https://clerk.com/docs/quickstarts/react)
- [Convex React Quickstart](https://docs.convex.dev/quickstart/react)
- [Convex Agent Component](https://github.com/get-convex/agent)
- [Convex Presence Component](https://www.convex.dev/components/presence)
- [Tauri Deep Links](https://tauri.app/plugin/deep-link/)

---

*Document Version: 3.0*
*Last Updated: December 26, 2024*
*Authors: Nabeel + Claude*
