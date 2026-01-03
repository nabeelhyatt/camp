# Web Deployment Feasibility

This document analyzes what's required to deploy Camp as a web application, in addition to the current Tauri desktop app.

## Executive Summary

**Feasibility: Medium effort**

The major blocker (SQLite) is already being migrated to Convex. Once complete, web deployment becomes straightforward for core chat functionality. Some features (MCP servers, file attachments, shell execution) will need backend APIs or feature removal for web.

---

## Architecture Comparison

```
Desktop (Tauri)                    Web
├── React Frontend ────────────────├── Same React Frontend
├── Convex (cloud DB) ─────────────├── Same Convex
├── Clerk Auth ────────────────────├── Same Clerk Auth
├── SQLite (local, being removed) ─├── N/A
├── Tauri Rust Backend ────────────├── Needs replacement
│   ├── File System                │   ├── Supabase Storage / S3
│   ├── Shell/Process              │   ├── Backend API (serverless)
│   ├── Clipboard                  │   ├── Web Clipboard API
│   ├── Notifications              │   ├── Web Notifications API
│   └── Auto-updates               │   └── N/A (handled by deployment)
└── MCP Servers (local processes) ─└── Backend-hosted or disabled
```

---

## Current Tauri Dependencies

The app uses 15 Tauri plugins:

| Plugin                     | Usage                         | Web Alternative                  | Effort |
| -------------------------- | ----------------------------- | -------------------------------- | ------ |
| `plugin-sql`               | SQLite database               | Convex (migration in progress)   | Done   |
| `plugin-fs`                | File read/write               | Supabase Storage or browser APIs | Medium |
| `plugin-shell`             | Run MCP servers, execute code | Backend API                      | High   |
| `plugin-clipboard-manager` | Copy to clipboard             | `navigator.clipboard`            | Low    |
| `plugin-notification`      | Desktop notifications         | Web Notifications API            | Low    |
| `plugin-dialog`            | File picker                   | `<input type="file">`            | Low    |
| `plugin-store`             | Persistent settings           | Convex or localStorage           | Low    |
| `plugin-http`              | Fetch URLs                    | Native `fetch()`                 | Low    |
| `plugin-deep-link`         | `camp://` URLs                | Standard HTTP routing            | Low    |
| `plugin-opener`            | Open URLs/files               | `window.open()`                  | Low    |
| `plugin-os`                | Platform info                 | `navigator`                      | Low    |
| `plugin-process`           | Restart app                   | Page reload                      | Low    |
| `plugin-updater`           | Auto-updates                  | N/A for web                      | None   |
| `plugin-global-shortcut`   | Quick chat hotkey             | Limited in browser               | N/A    |
| `plugin-stronghold`        | Secure storage                | Convex + encryption              | Medium |

---

## Migration Status

### Already Done / In Progress

-   **Database**: SQLite → Convex migration is underway via `UnifiedChatAPI.ts`
-   **Authentication**: Clerk works for both web and desktop

### Quick Wins (1-2 days each)

1. **Clipboard**: Replace `@tauri-apps/plugin-clipboard-manager` with `navigator.clipboard.writeText()`
2. **Notifications**: Replace with Web Notifications API (same permission model)
3. **Dialogs**: Replace file picker with `<input type="file" />`
4. **HTTP**: Already compatible, just remove Tauri plugin import
5. **Settings storage**: Move to Convex or localStorage
6. **Deep links**: Use standard URL routes instead of `camp://` protocol

### Medium Effort (1-2 weeks)

1. **File attachments**:

    - Currently stored in app data directory
    - For web: Use Supabase Storage or S3
    - Create abstraction layer for upload/download

2. **Media cache**:
    - Generated images stored locally
    - For web: Store in cloud storage with CDN

### Hard Blockers (requires backend work)

#### 1. MCP Servers

**Current behavior**: MCP servers run as child processes via `@tauri-apps/plugin-shell`

**Web options**:

-   **Option A**: Run MCP servers on backend (Node.js/serverless), proxy requests
-   **Option B**: Disable MCP for web version
-   **Option C**: Use WebSocket to connect to locally-running MCP servers (dev only)

**Recommendation**: Start with Option B (disable), add Option A incrementally

#### 2. Code Execution

**Current behavior**: Code blocks can be executed via shell

**Web options**:

-   Disable code execution for web
-   Use sandboxed execution backend (e.g., Judge0, Piston API)

#### 3. Custom Toolsets

**Current behavior**: User-defined tools that run shell commands

**Web options**: Disable for web, or require backend execution

---

## Recommended Migration Path

### Phase 1: Core Web Support (MVP)

1. Finish Convex migration (remove all SQLite usage)
2. Create platform abstraction layer:
    ```typescript
    // src/core/platform/index.ts
    export const platform = {
      clipboard: { write: (text: string) => ... },
      notifications: { send: (title, body) => ... },
      storage: { get: (key) => ..., set: (key, val) => ... },
      // etc.
    }
    ```
3. Implement web versions of quick-win features
4. Stub out MCP/shell features for web (show "Desktop only" message)
5. Create Vite config for web-only build
6. Deploy to Vercel/Netlify

### Phase 2: File Support

1. Set up Supabase Storage or S3 bucket
2. Create upload/download abstraction
3. Migrate attachment handling to cloud storage
4. Enable file attachments on web

### Phase 3: MCP on Web (Optional)

1. Create backend API for MCP server management
2. Run MCP servers as backend services
3. Proxy MCP calls from web to backend

---

## Web Build Configuration

Add to `package.json`:

```json
{
    "scripts": {
        "build:web": "vite build --mode web",
        "preview:web": "vite preview"
    }
}
```

Create `vite.config.web.ts` or use mode-based configuration:

```typescript
// Exclude Tauri plugins when building for web
if (process.env.VITE_BUILD_TARGET === "web") {
    // Use web implementations
}
```

---

## Deployment Options

| Platform        | Pros                            | Cons                   |
| --------------- | ------------------------------- | ---------------------- |
| **Vercel**      | Easy, free tier, Edge functions | Serverless cold starts |
| **Netlify**     | Similar to Vercel               | Similar limitations    |
| **Railway**     | Full Node.js backend possible   | More setup             |
| **Render**      | Good for APIs                   | Cost                   |
| **Self-hosted** | Full control                    | Maintenance            |

**Recommendation**: Start with Vercel for static hosting. If MCP backend is needed, add Vercel Functions or separate backend service.

---

## Security Considerations for Web

1. **API Keys**: User API keys must be stored securely in Convex (encrypted)
2. **CORS**: Configure backend for web origin
3. **CSP**: Current CSP is `null` (Tauri mode). Web needs proper headers:
    ```
    Content-Security-Policy: default-src 'self'; script-src 'self' ...
    ```
4. **Rate Limiting**: Add to backend to prevent abuse
5. **Authentication**: Clerk handles this, but verify web flow

---

## Estimated Timeline

| Phase           | Scope                   | Effort    |
| --------------- | ----------------------- | --------- |
| Phase 1 (MVP)   | Core chat, no files/MCP | 2-3 weeks |
| Phase 2 (Files) | File attachments        | 1 week    |
| Phase 3 (MCP)   | Backend MCP servers     | 2-3 weeks |

**Total for full parity**: ~6-7 weeks

**For basic chat-only web version**: ~2-3 weeks after Convex migration completes

---

## Conclusion

Web deployment is feasible and the hardest part (database) is already being addressed. The recommended approach:

1. Complete Convex migration first
2. Build abstraction layer for platform APIs
3. Deploy MVP web version without MCP/file features
4. Add cloud storage for files
5. Consider backend MCP support based on user demand

The codebase is well-structured for this transition since most business logic is already in React/TypeScript and data flows through Convex.
