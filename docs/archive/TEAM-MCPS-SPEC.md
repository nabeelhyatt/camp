# Team MCPs & Shared API Keys - Feature Specification

**Status:** Implemented (Phases 1-5)
**Author:** Claude + Nabeel
**Date:** January 2025
**Related:** MULTIPLAYER-PLAN.md (Phase 3)

## Implementation Status

| Phase   | Description                                 | Status                |
| ------- | ------------------------------------------- | --------------------- |
| Phase 1 | Schema & Backend (Convex tables, mutations) | ✅ Done               |
| Phase 2 | Frontend API Layer (React hooks)            | ✅ Done               |
| Phase 3 | Wrapper & Runtime (TeamToolsetsWrapper)     | ✅ Done               |
| Phase 4 | MCP UI (Team tab in Tools)                  | ✅ Done               |
| Phase 5 | API Keys UI (Team section)                  | ✅ Done               |
| Phase 6 | Real AES-GCM Encryption                     | ⏳ Deferred to future |

### Implementation Notes

-   **Credential sharing:** Implemented using existing base64 encoding (same as existing apiKeys). Real AES-GCM encryption deferred to Phase 6.
-   **Wrapper approach:** Created `TeamToolsetsWrapper.ts` as pure utility functions instead of class-based wrapper to maintain simplicity
-   **TeamToolsetsAPI.ts:** Created combined hooks for merged local + team MCPs
-   **UI changes:** Added Team tab to Connections section, ApiKeysTab component with team sharing

---

---

## Executive Summary

This feature enables Camp users to share MCP configurations and API keys with their team workspace. Unlike admin-controlled team settings, any workspace member can share their personal MCPs and API keys, with full control over whether credentials are included.

### Core Value Proposition

-   **Democratized sharing** - Any team member can contribute tools, not just admins
-   **Flexibility** - Choose to share config-only or config+credentials
-   **Attribution** - See who shared what with avatar icons
-   **Privacy by default** - Everything starts private, sharing is opt-in

---

## User Stories

### As a team member who sets up an MCP:

1. I configure an MCP locally (e.g., Context7 for documentation)
2. I see a "Private/Team" toggle next to my MCP
3. When I click "Team", I'm asked if I want to share credentials
4. I choose to share with credentials (it's a general API)
5. My teammates now see this MCP in their Team MCPs tab with my avatar

### As a team member who wants to use a shared MCP:

1. I go to Settings → Connections → Team MCPs tab
2. I see MCPs shared by teammates, each with their avatar
3. One MCP shows "Setup required" badge (shared without credentials)
4. I click the badge and enter my own API key
5. The MCP now works for me using my credentials

### As someone who shared an MCP and wants to stop:

1. I toggle my MCP from "Team" back to "Private"
2. It immediately disappears from all teammates' Team MCPs tabs
3. Their personal credentials for this MCP are cleaned up

---

## Detailed Requirements

### 1. Sharing Model

| Aspect                 | Behavior                                              |
| ---------------------- | ----------------------------------------------------- |
| **Default visibility** | Private (local only)                                  |
| **Who can share**      | Any workspace member (no admin required)              |
| **What's shared**      | Config only OR config + credentials (sharer's choice) |
| **Duplicates**         | Allowed - multiple users can share same MCP/provider  |
| **Attribution**        | Sharer's avatar displayed on all shared items         |
| **Unsharing**          | Immediate removal from all teammates                  |

### 2. Credential Handling

When sharing **with credentials**:

-   Environment variables are encrypted and stored in Convex
-   All team members use the sharer's credentials
-   Credentials are decrypted server-side only (never sent to other clients)

When sharing **without credentials**:

-   Only command/args are shared
-   Item shows "Setup required" badge for other users
-   Each user can add their own credentials
-   User credentials stored separately in `mcpUserSecrets` table

**Credential resolution order:**

1. User's personal credentials (if they added their own)
2. Sharer's credentials (if included)
3. None → MCP disabled with "Setup required" badge

### 3. UI Components

#### Share Toggle

-   Located next to each MCP/API key in Settings
-   Two states: "Private" (default) / "Team"
-   Only visible in team workspaces
-   When toggled to Team, opens credentials dialog

#### Share Credentials Dialog

```
┌─────────────────────────────────────────────────────┐
│ Share "context7" with team                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Suggestion: Share credentials with team if it's    │
│ a general API/MCP, do not if it is primarily a     │
│ personal account.                                   │
│                                                     │
│ ┌─────────────────────┐  ┌────────────────────────┐│
│ │ Share without       │  │ Share with credentials ││
│ │ credentials         │  │                        ││
│ └─────────────────────┘  └────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

#### Setup Required Badge

-   Amber/yellow badge: "Setup required"
-   Shown on MCPs shared without credentials
-   Clicking opens credential input form
-   Badge disappears once user adds credentials

#### Team MCPs Tab

-   New tab in Settings → Connections
-   Shows all MCPs shared by team members
-   Each row shows:
    -   MCP name and command
    -   Sharer's avatar with tooltip "Shared by [Name]"
    -   Setup required badge (if applicable)
    -   Actions: Setup credentials, Copy command

#### Avatar Attribution

-   Small avatar (20x20px) next to shared items
-   Tooltip shows "Shared by [Display Name]"
-   For duplicates: show multiple avatars (stack or row)

### 4. Data Model

#### Updated `mcpConfigs` table

```typescript
mcpConfigs: defineTable({
    // Existing fields
    workspaceId: v.id("workspaces"),
    name: v.string(),
    type: v.union(v.literal("api"), v.literal("local")),
    config: v.object({
        command: v.string(),
        args: v.string(),
        env: v.optional(v.string()), // Encrypted, only if includeCredentials
    }),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),

    // NEW: Sharing fields
    sharedBy: v.id("users"),
    sharerSnapshot: v.object({
        userId: v.id("users"),
        displayName: v.string(),
        avatarUrl: v.optional(v.string()),
    }),
    includeCredentials: v.boolean(),
    createdBy: v.id("users"),
})
    .index("by_workspace", ["workspaceId"])
    .index("by_shared_by", ["sharedBy"]);
```

#### Updated `apiKeys` table

```typescript
apiKeys: defineTable({
    // Existing fields
    workspaceId: v.id("workspaces"),
    provider: v.string(),
    encryptedKey: v.string(),
    keyHint: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),

    // NEW: Sharing fields
    sharedBy: v.id("users"),
    sharerSnapshot: v.object({
        userId: v.id("users"),
        displayName: v.string(),
        avatarUrl: v.optional(v.string()),
    }),
    createdBy: v.id("users"),
})
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_provider", ["workspaceId", "provider"])
    .index("by_shared_by", ["sharedBy"]);
```

#### New `mcpUserSecrets` table

```typescript
mcpUserSecrets: defineTable({
    userId: v.id("users"),
    mcpConfigId: v.id("mcpConfigs"),
    encryptedEnv: v.string(), // User's personal credentials
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_user", ["userId"])
    .index("by_mcp_config", ["mcpConfigId"])
    .index("by_user_and_mcp", ["userId", "mcpConfigId"]);
```

### 5. API Endpoints

#### MCP Sharing (convex/mcpConfigs.ts)

| Function            | Type     | Args                                          | Returns                              |
| ------------------- | -------- | --------------------------------------------- | ------------------------------------ |
| `listForWorkspace`  | query    | workspaceId, clerkId                          | Array of MCPs with `needsSetup` flag |
| `shareMcp`          | mutation | name, command, args, env?, includeCredentials | { \_id }                             |
| `unshareMcp`        | mutation | mcpConfigId                                   | { success }                          |
| `updateSharedMcp`   | mutation | mcpConfigId, updates                          | { success }                          |
| `setUserSecrets`    | mutation | mcpConfigId, encryptedEnv                     | { \_id }                             |
| `deleteUserSecrets` | mutation | mcpConfigId                                   | { success }                          |

#### API Key Sharing (convex/apiKeys.ts - updates)

| Function           | Type     | Args                            | Returns                |
| ------------------ | -------- | ------------------------------- | ---------------------- |
| `shareKey`         | mutation | provider, encryptedKey, keyHint | { \_id }               |
| `unshareKey`       | mutation | keyId                           | { success }            |
| `listForWorkspace` | query    | workspaceId, clerkId            | Array with sharer info |

### 6. Frontend Hooks

#### New: src/core/camp/api/TeamMcpAPI.ts

```typescript
// List team MCPs for current workspace
useTeamMcps(): TeamMcp[] | undefined

// Share an MCP with the team
useShareMcp(): (config: ShareMcpInput) => Promise<{ _id: string }>

// Unshare an MCP
useUnshareMcp(): (mcpConfigId: string) => Promise<{ success: boolean }>

// Set user's personal credentials for a shared MCP
useSetMcpUserSecrets(): (mcpConfigId: string, env: string) => Promise<{ _id: string }>

// Delete user's personal credentials
useDeleteMcpUserSecrets(): (mcpConfigId: string) => Promise<{ success: boolean }>
```

#### Updated: src/core/chorus/api/ToolsetsAPI.ts

```typescript
// Merged view of local + team MCPs
useAllMcpConfigs(): {
    local: CustomToolsetConfig[];
    team: TeamMcpConfig[];
    all: MergedMcpConfig[];
}
```

### 7. Runtime Behavior

#### Architecture: Wrapper Approach (Tier 1 Preservation)

**Problem:** `ToolsetsManager.ts` is Tier 1 (upstream sync - never modify).

**Solution:** Create a wrapper that feeds team MCPs as if they were local:

```
┌─────────────────────────────────────────────────────────┐
│ TeamToolsetsWrapper (NEW - Tier 3)                      │
│                                                         │
│  1. Fetch team MCPs from Convex                         │
│  2. Decrypt credentials client-side                     │
│  3. Convert to CustomToolsetConfig format               │
│  4. Pass merged configs to ToolsetsManager              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ ToolsetsManager (UNCHANGED - Tier 1)                    │
│                                                         │
│  Sees team MCPs as regular custom toolsets              │
│  No code changes required                               │
└─────────────────────────────────────────────────────────┘
```

**New file:** `src/core/camp/TeamToolsetsWrapper.ts`

```typescript
export class TeamToolsetsWrapper {
    private toolsetsManager: ToolsetsManager;
    private currentWorkspaceId: string | null = null;
    private credentialCache: Map<string, { value: string; expiry: number }> =
        new Map();
    private CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    async refreshWithTeamMcps(
        workspaceId: string,
        localConfigs: CustomToolsetConfig[],
        teamMcps: TeamMcpConfig[],
        userSecrets: Map<string, McpUserSecrets>,
    ) {
        // Handle workspace switch - stop old MCPs first
        if (
            this.currentWorkspaceId &&
            this.currentWorkspaceId !== workspaceId
        ) {
            await this.stopTeamMcps();
            this.credentialCache.clear();
        }
        this.currentWorkspaceId = workspaceId;

        // Convert team MCPs to local format with decrypted credentials
        const resolvedTeamConfigs = teamMcps
            .filter((mcp) => !mcp.needsSetup)
            .map((mcp) => this.resolveTeamMcp(mcp, userSecrets.get(mcp._id)));

        // Merge and pass to original manager
        const allConfigs = [...localConfigs, ...resolvedTeamConfigs];
        await this.toolsetsManager.refreshToolsets(toolsetsConfig, allConfigs);
    }

    private async stopTeamMcps(): Promise<void> {
        // Stop all team MCPs from previous workspace
        const teamToolsets = this.toolsetsManager
            .listToolsets()
            .filter((t) => t.name.startsWith("team_"));
        for (const toolset of teamToolsets) {
            await toolset.close();
        }
    }

    private resolveTeamMcp(
        mcp: TeamMcpConfig,
        userSecret?: McpUserSecrets,
    ): CustomToolsetConfig {
        const env = this.resolveCredentialsWithCache(mcp, userSecret);
        return {
            name: `team_${mcp.name}`, // Prefix to avoid collisions
            command: mcp.config.command,
            args: mcp.config.args,
            env: env ?? "{}",
        };
    }

    private resolveCredentialsWithCache(
        mcp: TeamMcpConfig,
        userSecret?: McpUserSecrets,
    ): string | null {
        const cacheKey = userSecret ? `user_${mcp._id}` : `shared_${mcp._id}`;
        const cached = this.credentialCache.get(cacheKey);

        if (cached && cached.expiry > Date.now()) {
            return cached.value;
        }

        const resolved = this.resolveCredentials(mcp, userSecret);
        if (resolved) {
            this.credentialCache.set(cacheKey, {
                value: resolved,
                expiry: Date.now() + this.CACHE_TTL_MS,
            });
        }
        return resolved;
    }

    invalidateCredentialCache(mcpConfigId: string): void {
        // Called when user updates their credentials
        this.credentialCache.delete(`user_${mcpConfigId}`);
        this.credentialCache.delete(`shared_${mcpConfigId}`);
    }
}
```

#### Credential Data Flow

**Critical:** Credentials are decrypted CLIENT-SIDE, never on server.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    Convex    │    │   Client     │    │   Client     │    │  MCP Server  │
│   (Cloud)    │───▶│   (Fetch)    │───▶│  (Decrypt)   │───▶│   (Local)    │
│              │    │              │    │              │    │              │
│ Encrypted    │    │ Encrypted    │    │ Plaintext    │    │ Uses creds   │
│ credentials  │    │ credentials  │    │ credentials  │    │ for API calls│
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

1. **Storage:** Encrypted env vars stored in Convex `mcpConfigs.config.env`
2. **Fetch:** Client fetches encrypted data via Convex query
3. **Decrypt:** Client decrypts using workspace key (stored locally)
4. **Pass:** Plaintext passed to MCP server as environment variables
5. **Execute:** MCP server uses credentials for API calls

**Key security property:** Convex servers never see plaintext credentials.

#### Credential Resolution

```typescript
function resolveCredentials(
    teamMcp: TeamMcp,
    userSecrets?: McpUserSecrets,
): string | null {
    // User's own credentials take priority
    if (userSecrets?.encryptedEnv) {
        return decrypt(userSecrets.encryptedEnv);
    }

    // Fall back to sharer's credentials
    if (teamMcp.includeCredentials && teamMcp.config.env) {
        return decrypt(teamMcp.config.env);
    }

    // No credentials available
    return null;
}
```

---

## Edge Cases & Error Handling

### Edge Case: Sharer unshares while teammate is using MCP

-   **Behavior:** MCP stops working on next refresh
-   **UI:** MCP disappears from Team MCPs tab
-   **Cleanup:** User's personal secrets for that MCP are deleted

### Edge Case: Sharer updates shared MCP config

-   **Behavior:** All teammates get updated config on next refresh
-   **Note:** User secrets are preserved (they provided their own credentials)

### Edge Case: User tries to share MCP with same name as existing

-   **Behavior:** Allow it - duplicates are permitted
-   **Display:** Both show in list with respective sharer avatars

### Edge Case: Workspace changes from team to personal

-   **Behavior:** Team MCPs become inaccessible
-   **Note:** Data preserved, visible again if workspace becomes team

### Error: Shared MCP fails to start

-   **Display:** Show error state in ToolsBox (red indicator)
-   **Logs:** Available via MCP logs button
-   **Recovery:** User can try their own credentials

---

## Security Considerations

### Current State: Base64 is NOT Encryption

**Problem:** The existing `apiKeys.ts` uses base64 encoding, not real encryption:

```typescript
// This is NOT secure - it's just encoding
const "encrypted" = btoa(plaintext);
```

### Required: Real AES-GCM Encryption

Before enabling "share with credentials", implement proper encryption:

```typescript
// src/core/camp/crypto.ts

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

export async function deriveWorkspaceKey(
    workspaceId: string,
    userSecret: string,
): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(userSecret),
        "PBKDF2",
        false,
        ["deriveKey"],
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: encoder.encode(workspaceId),
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: ALGORITHM, length: KEY_LENGTH },
        false,
        ["encrypt", "decrypt"],
    );
}

export async function encrypt(
    plaintext: string,
    key: CryptoKey,
): Promise<string> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv },
        key,
        encoder.encode(plaintext),
    );

    // Combine IV + ciphertext and base64 encode
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return btoa(String.fromCharCode(...combined));
}

export async function decrypt(
    encrypted: string,
    key: CryptoKey,
): Promise<string> {
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const plaintext = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv },
        key,
        ciphertext,
    );

    return new TextDecoder().decode(plaintext);
}
```

### Phased Security Rollout

**Phase 1 (MVP):** Share config without credentials only

-   Safe - no secrets transmitted
-   Users must provide their own credentials
-   Validates the UX before adding encryption complexity

**Phase 2 (Fast-follow):** Add real encryption

-   Implement AES-GCM as shown above
-   Key derived from workspace ID + user's Clerk session
-   Enable "share with credentials" option

### Access Control

-   Only workspace members can see shared MCPs/keys
-   Only the sharer can unshare their own items
-   Users can only access their own mcpUserSecrets

### Audit Trail

-   `createdBy` and `sharedBy` fields track who created/shared
-   `deletedBy` tracks who unshared
-   Soft deletes preserve history

### Key Storage

-   Workspace encryption key derived client-side
-   Based on workspace ID + user's auth session
-   Never stored in Convex - derived on demand
-   Each user derives the same key for their workspace

---

## Migration & Rollout

### MVP Scope (No Credential Sharing)

For MVP, we ship **config sharing only** (no credentials). This:

-   Avoids the encryption complexity
-   Validates the UX and data flow
-   Is fully safe - no secrets transmitted
-   Users provide their own credentials via "Setup required" flow

The "Share with credentials" button is **disabled** in MVP with tooltip: "Coming soon"

### Phase 1: Schema & Backend

1. Deploy schema changes to Convex (mcpConfigs, mcpUserSecrets)
2. Create new `convex/mcpConfigs.ts` functions
3. Update `convex/apiKeys.ts` with sharer fields
4. Test via Convex dashboard

### Phase 2: Frontend API Layer

1. Create `src/core/camp/api/TeamMcpAPI.ts` hooks
2. Create `src/core/camp/api/TeamApiKeysAPI.ts` hooks
3. Update `ToolsetsAPI.ts` with merged hooks

### Phase 3: Wrapper & Runtime

1. Create `src/core/camp/TeamToolsetsWrapper.ts`
2. Integrate wrapper with existing ToolsetsManager
3. Test MCP startup with team configs (without shared credentials)

### Phase 4: MCP UI

1. Add share toggle to existing MCP rows
2. Implement share dialog (credentials option disabled for MVP)
3. Add Team MCPs tab
4. Add "Setup required" badge and credential input flow

### Phase 5: API Keys UI

1. Apply same patterns to API keys section
2. Avatar attribution display

### Phase 6: Real Encryption (Post-MVP)

1. Implement `src/core/camp/crypto.ts` with AES-GCM
2. Add workspace key derivation
3. Enable "Share with credentials" option
4. Migrate any existing base64 "encrypted" data

### Feature Flag

-   Use `campConfig.enableTeamMcpSharing` for gradual rollout
-   Default: enabled for team workspaces
-   Separate flag `campConfig.enableCredentialSharing` for Phase 6

---

## Success Metrics

| Metric                         | Target                            |
| ------------------------------ | --------------------------------- |
| Team MCPs shared per workspace | 3+ MCPs shared in active teams    |
| Credential sharing rate        | 60%+ share with credentials       |
| Setup completion rate          | 80%+ complete setup when required |
| Unshare rate                   | <10% unshare within first week    |

---

## Open Questions

1. **Should we show a confirmation when unsharing?**

    - Recommendation: No, keep it simple. Toggle is reversible.

2. **Should admins be able to unshare others' MCPs?**

    - Recommendation: No, keep it democratic. Admins can kick users if needed.

3. **Should we support MCP "templates" (config without any credentials)?**

    - Recommendation: Defer. Current "share without credentials" covers this.

4. **Should users be notified when an MCP they use is unshared?**
    - Recommendation: Defer. They'll see it's gone. Consider for Phase 2.

---

## Additional User Stories (CTO Review)

### As someone who rotates their shared credentials:

1. I go to my shared MCP in Settings
2. I update the API key
3. All teammates automatically get the new key on next refresh
4. No notification needed (transparent update)

### As someone who switches workspaces:

1. I'm using "Acme Team" workspace with their team MCPs running
2. I switch to "Beta Corp" workspace in the sidebar
3. Acme's team MCPs stop running
4. Beta Corp's team MCPs start loading
5. Brief loading state shows during transition

### As someone using a failing team MCP:

1. I try to use a team MCP but it fails to connect
2. I see a warning toast: "MCP [name] failed - you may need to configure credentials"
3. The MCP is marked with error state in Settings
4. I can click to try adding my own credentials
5. The MCP works with my credentials

---

## Edge Case Decisions (CTO Review Round 2)

The following edge cases were reviewed and decisions documented:

### Process Lifecycle

| Issue                               | Decision             | Rationale                                                                                            |
| ----------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| **Process cleanup on unshare**      | Let it die naturally | MCP continues until next refresh clears it. Simpler implementation, rare edge case.                  |
| **In-flight tool calls on unshare** | Complete then fail   | In-flight calls complete with current credentials. Future calls fail with "MCP no longer available". |

### Name Collisions

| Issue                               | Decision                 | Rationale                                                                                           |
| ----------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| **Claude Desktop import collision** | Show both, local default | Allow duplicates. Both MCPs appear in list. Local MCP takes priority by default in tool resolution. |
| **MCP name validation**             | Same validation rules    | Apply `/^[a-z0-9-]+$/` to team MCPs. Reject invalid names on share attempt.                         |

### Error Handling

| Issue                         | Decision           | Rationale                                                                                         |
| ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| **Env var parsing failure**   | Warning + fallback | Show warning toast but allow MCP to start without credentials. User can configure manually.       |
| **"Setup Required" blocking** | Allow with warning | Let user try, show clear error: "Configure your credentials for [MCP] in Settings" if auth fails. |

### Workspace Switching

| Issue                        | Decision            | Rationale                                                                                              |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| **Workspace switch cleanup** | Stop all, start new | Stop all team MCPs from old workspace. Start new workspace MCPs. Show loading state during transition. |

### Caching & Performance

| Issue                             | Decision            | Rationale                                                                                               |
| --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Credential resolution caching** | Add 5-min TTL cache | Cache credentials with 5-minute TTL to reduce Convex queries. Invalidate on explicit credential change. |
| **Rate limiting share/unshare**   | 500ms debounce      | Add debounce on share toggle to prevent rapid mutations.                                                |

### Type System

| Issue                          | Decision               | Rationale                                                                                           |
| ------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------- |
| **Toolsets.ts type extension** | Modify Tier 1 types    | Types are low-risk changes. Add optional fields to `CustomToolsetConfig`.                           |
| **ToolsetsAPI.ts changes**     | Minimal Tier 2 changes | Add one `useAllMcpConfigs()` hook that merges local + team. Keep other changes in new Tier 3 files. |

### Miscellaneous

| Issue                          | Decision           | Rationale                                                                   |
| ------------------------------ | ------------------ | --------------------------------------------------------------------------- |
| **Credential rotation**        | Transparent update | Teammates get new key on next refresh. No notification needed.              |
| **Sidecar credential logging** | Assume safe        | Trust current implementation doesn't log env vars. No audit needed for MVP. |
| **Avatar staleness**           | Accept staleness   | Document as known behavior. Avatar shows state at share-time.               |
| **Bulk share UI**              | Future iteration   | Not MVP. Add "Share All" in v1.1 enhancement.                               |

### Known Limitations (Documented)

1. **Avatar staleness**: Sharer's avatar captured at share-time. If they update their avatar, shared MCPs show old avatar until re-shared.
2. **Process cleanup delay**: When MCP is unshared, running processes continue until next refresh cycle (~60s max).
3. **No bulk operations**: Users must share/configure MCPs one at a time in MVP.

---

## Appendix: File Changes Summary

### New Files

| File                                   | Purpose                                               |
| -------------------------------------- | ----------------------------------------------------- |
| `convex/mcpConfigs.ts`                 | Convex queries/mutations for MCP sharing              |
| `src/core/camp/api/TeamMcpAPI.ts`      | React hooks for team MCPs                             |
| `src/core/camp/api/TeamApiKeysAPI.ts`  | React hooks for shared API keys                       |
| `src/core/camp/TeamToolsetsWrapper.ts` | Wrapper to feed team MCPs to ToolsetsManager (Tier 3) |
| `src/core/camp/crypto.ts`              | AES-GCM encryption utilities (Phase 6)                |

### Modified Files

| File                                 | Changes                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `convex/schema.ts`                   | Add fields to mcpConfigs, apiKeys; add mcpUserSecrets table                 |
| `convex/apiKeys.ts`                  | Add shareKey, unshareKey; add sharer fields (keep existing admin functions) |
| `src/core/chorus/api/ToolsetsAPI.ts` | Add useAllMcpConfigs hook                                                   |
| `src/ui/components/Settings.tsx`     | Add share toggle, dialogs, Team MCPs tab                                    |

### Unchanged (Tier 1 - Preserved)

| File                                 | Notes                                      |
| ------------------------------------ | ------------------------------------------ |
| `src/core/chorus/ToolsetsManager.ts` | No changes - wrapper approach used instead |
| `src/core/chorus/Toolsets.ts`        | No changes                                 |
| `src/core/chorus/MCPStdioTauri.ts`   | No changes                                 |

### Permission Model Reconciliation

The existing admin-only functions in `apiKeys.ts` remain unchanged:

-   `setTeamKey` - Admin sets workspace default key
-   `deleteTeamKey` - Admin removes workspace default key

New functions are **additive** for user-level sharing:

-   `shareKey` - Any user shares their personal key with team
-   `unshareKey` - User removes their own shared key

**Resolution order for API keys:**

1. User's personal shared key (new)
2. Workspace admin key (existing)
3. Default env var key (existing)
4. Error
