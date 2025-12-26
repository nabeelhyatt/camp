# Camp - Project Requirements Document (PRD)

## Overview

| Field           | Value                                                             |
| --------------- | ----------------------------------------------------------------- |
| **Project**     | Fork Chorus and rebrand as "Camp"                                 |
| **Vision**      | Multiplayer AI workspace for group projects - "Slack for AI work" |
| **Produced by** | Spark Capital                                                     |
| **Repository**  | https://github.com/nabeelhyatt/camp                               |
| **Domain**      | getcamp.ai                                                        |
| **Contact**     | nabeel@sparkcapital.com                                           |
| **Icon**        | Campfire logo (flame + logs in circle)                            |

---

## Phase 1 Exit Criteria

Phase 1 is complete when ALL of the following are true:

### Build Verification

-   [ ] `pnpm install` completes without errors
-   [ ] `pnpm run camp:verify` passes (lint + typecheck + both architecture builds)
-   [ ] Built app launches and displays "Camp" in window title and menu bar
-   [ ] Bundle identifier shows `ai.getcamp.app` (not `sh.chorus.app`)

### UI String Audit

-   [ ] No "Chorus" strings visible in: window title, menu bar, settings, onboarding, empty states, tooltips, error messages
-   [ ] Contact email shows `nabeel@sparkcapital.com` (not `humans@chorus.sh`)
-   [ ] Deep links use `camp://` scheme

### Documentation

-   [ ] README.md describes Camp with Chorus attribution
-   [ ] CLAUDE.md updated for Camp context
-   [ ] LICENSE updated: "Copyright (c) 2025 Spark Capital"

### Icon Verification

-   [ ] Camp icon (campfire) appears in dock when app runs
-   [ ] Camp icon appears in macOS app switcher (Cmd+Tab)

### Data Isolation

-   [ ] App writes to `~/Library/Application Support/ai.getcamp.app*` (not `sh.chorus.app*`)
-   [ ] Dev instances use `ai.getcamp.app.dev.*` identifiers

### Analytics

-   [ ] PostHog disabled (empty key) - no analytics sent to Chorus project

### End-to-End Smoke Test

-   [ ] Deep link `camp://` opens app
-   [ ] Quick chat works
-   [ ] Settings page opens, no "Chorus" visible
-   [ ] Onboarding flow displays correctly
-   [ ] GitHub OAuth flow works (via Chorus backend - expected)
-   [ ] Slack OAuth flow works (via Chorus backend - expected)
-   [ ] MCP connections work
-   [ ] System prompt references "Camp" not "Chorus"

---

## Automated Verification

### `pnpm run camp:verify` Script

Add to `package.json`:

```json
{
    "scripts": {
        "camp:verify": "pnpm run lint && pnpm run typecheck && pnpm tauri build --target aarch64-apple-darwin && pnpm tauri build --target x86_64-apple-darwin",
        "camp:verify:quick": "pnpm run lint && pnpm run typecheck && pnpm tauri build --debug"
    }
}
```

Run before any Camp artifact ships. This proves:

-   Code passes lint/typecheck
-   Both Mac architectures build successfully
-   Bundle IDs and configs are valid

---

## Phase 1: Repository Setup

### Step 1.1: Set Up New GitHub Repository

```bash
# Repo already created: https://github.com/nabeelhyatt/camp

# Locally - rename current remote and add new one:
git remote rename origin upstream    # Keep meltylabs/chorus for cherry-picking
git remote add origin git@github.com:nabeelhyatt/camp.git
git push -u origin nabeelhyatt/context-box-ui:main
```

**Verification:**

```bash
git remote -v
# Should show:
# origin    git@github.com:nabeelhyatt/camp.git (fetch/push)
# upstream  https://github.com/meltylabs/chorus.git (fetch/push)
```

### Step 1.2: Upstream Sync Policy

**Owner**: Nabeel Hyatt

**Cadence**: Check upstream weekly for relevant commits

**Process**:

1. `git fetch upstream`
2. Review new commits: `git log upstream/main --oneline -20`
3. Cherry-pick relevant bug fixes (avoid branding/feature commits)
4. Document in `docs/UPSTREAM-SYNC.md` (create this file)

**When to cherry-pick vs. skip**:

-   **Cherry-pick**: SDK updates, bug fixes, TypeScript fixes, build improvements
-   **Skip**: Chorus-specific features, branding changes, UI copy changes

**Conflict Log**: Track in `docs/UPSTREAM-SYNC.md`:

```markdown
# Upstream Sync Log

Camp maintains compatibility with [Chorus](https://github.com/meltylabs/chorus)
to facilitate cherry-picking bug fixes and improvements.

## Sync Log

| Date       | Commit | Description       | Status | Notes |
| ---------- | ------ | ----------------- | ------ | ----- |
| 2024-XX-XX | abc123 | OpenAI SDK update | Merged | Clean |
```

---

## Phase 2: Rebrand - Complete File List

### 2.1 Package Configuration (Critical)

| File                   | Change                                                                 | Verification                    |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------- |
| `package.json`         | `"name": "chorus"` → `"name": "camp"`, add `camp:verify` scripts       | `grep -n '"name"' package.json` |
| `src-tauri/Cargo.toml` | `name = "chorus"` → `name = "camp"`, update description, `default-run` | `cargo check`                   |

### 2.2 Tauri Configuration (Critical - App Identity)

| File                                  | Change                                                                                          | Verification                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `src-tauri/tauri.conf.json`           | productName: "Camp", identifier: "ai.getcamp.app", title: "Camp", schemes: ["camp"]             | `pnpm tauri build --debug` then check bundle ID |
| `src-tauri/tauri.dev.conf.json`       | productName: "Camp", identifier: "ai.getcamp.app.dev", title: "Camp Dev", schemes: ["camp-dev"] | `pnpm run dev` then check window title          |
| `src-tauri/tauri.qa.conf.json`        | productName: "Camp", identifier: "ai.getcamp.app.qa", title: "Camp QA"                          | N/A (QA builds)                                 |
| `src-tauri/capabilities/default.json` | Keep `app.chorus.sh` URL for now (OAuth dependency)                                             | N/A                                             |

**Bundle Identifiers**:

-   Production: `ai.getcamp.app`
-   Development: `ai.getcamp.app.dev`
-   QA: `ai.getcamp.app.qa`

**Deep Link Schemes**:

-   Production: `camp://`
-   Development: `camp-dev://`

### 2.3 Backend Configuration (Critical - Functionality)

Create environment-driven centralized config in `src/core/campConfig.ts`:

```typescript
// =============================================================================
// CAMP CONFIGURATION
// =============================================================================
// Environment-driven config for easy switching between backends.
// Set VITE_CAMP_BACKEND=camp to use Camp backend (when ready).
// =============================================================================

const isDev = import.meta.env.DEV;
const CAMP_BACKEND = import.meta.env.VITE_CAMP_BACKEND || "chorus";

// Backend URLs
const BACKEND_URLS = {
    chorus: "https://app.chorus.sh",
    camp: "https://app.getcamp.ai",
} as const;

const CAMP_PROXY_URL =
    BACKEND_URLS[CAMP_BACKEND as keyof typeof BACKEND_URLS] ||
    BACKEND_URLS.chorus;

// Derived URLs
const CAMP_GITHUB_AUTH_URL = `${CAMP_PROXY_URL}/auth/github_integration`;
const CAMP_SLACK_AUTH_URL = `${CAMP_PROXY_URL}/auth/slack`;

// Feature flags
// Set to false to disable integrations if backend is unavailable
const ENABLE_GITHUB_INTEGRATION = true;
const ENABLE_SLACK_INTEGRATION = true;

// Analytics - DISABLED for Phase 1
// TODO: Create Camp PostHog project and add key here
const POSTHOG_KEY = ""; // Empty = disabled

export const campConfig = {
    isDev,
    backend: CAMP_BACKEND,
    dbUrl: "sqlite:chats.db",
    proxyUrl: CAMP_PROXY_URL,
    githubAuthUrl: CAMP_GITHUB_AUTH_URL,
    slackAuthUrl: CAMP_SLACK_AUTH_URL,
    enableGithubIntegration: ENABLE_GITHUB_INTEGRATION,
    enableSlackIntegration: ENABLE_SLACK_INTEGRATION,
    posthogKey: POSTHOG_KEY,

    // For debugging
    isUsingChorusBackend: CAMP_BACKEND === "chorus",
} as const;

// Re-export for backwards compatibility during migration
export const config = {
    tellPostHogIAmATestUser: isDev,
    dbUrl: campConfig.dbUrl,
    meltyProxyUrl: campConfig.proxyUrl, // Legacy name, will remove
} as const;
```

**Usage in `.env` (optional)**:

```bash
# Use Chorus backend (default)
VITE_CAMP_BACKEND=chorus

# Use Camp backend (when ready)
VITE_CAMP_BACKEND=camp
```

Then update toolsets to use campConfig:

-   `src/core/chorus/toolsets/github.ts:32` → `campConfig.githubAuthUrl`
-   `src/core/chorus/toolsets/slack.ts:37` → `campConfig.slackAuthUrl`

**Verification**: `grep -r "app.chorus.sh" src/` should only show campConfig.ts

### 2.4 UI Strings (User-Facing)

| File                                 | Strings to Update                                              | Verification                                                     |
| ------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `index.html`                         | `<title>Chorus</title>` → `<title>Camp</title>`                | Open in browser                                                  |
| `src/ui/App.tsx`                     | All "Chorus" → "Camp" (search for exact occurrences)           | `grep -n "Chorus" src/ui/App.tsx`                                |
| `src/ui/components/Settings.tsx`     | "Chorus MCPs" → "Camp MCPs", email → `nabeel@sparkcapital.com` | `grep -n "Chorus\|chorus.sh" src/ui/components/Settings.tsx`     |
| `src/ui/components/ChatInput.tsx`    | "What can Chorus do" → "What can Camp do"                      | `grep -n "Chorus" src/ui/components/ChatInput.tsx`               |
| `src/ui/components/EmptyState.tsx`   | "Chorus will read" → "Camp will read"                          | `grep -n "Chorus" src/ui/components/EmptyState.tsx`              |
| `src/ui/components/Onboarding.tsx`   | "Welcome to Chorus" → "Welcome to Camp"                        | `grep -n "Chorus" src/ui/components/Onboarding.tsx`              |
| `src/core/chorus/prompts/prompts.ts` | System prompt: update app name AND contact email               | `grep -n "Chorus\|chorus.sh" src/core/chorus/prompts/prompts.ts` |

**UI String Tracking Checklist** (check off as completed):

-   [ ] Window title (index.html)
-   [ ] App.tsx - GitHub toast (~line 330)
-   [ ] App.tsx - Open source announcement (~line 802)
-   [ ] App.tsx - Activation message (~line 832)
-   [ ] App.tsx - PATH warning (~line 1049)
-   [ ] Settings.tsx - MCP section (~line 906)
-   [ ] Settings.tsx - Settings header (~line 1368)
-   [ ] Settings.tsx - API keys message (~line 1422)
-   [ ] Settings.tsx - Proxy placeholder (~line 1883)
-   [ ] Settings.tsx - Contact email (all occurrences of humans@chorus.sh)
-   [ ] ChatInput.tsx - Screenshot permission (~line 246)
-   [ ] ChatInput.tsx - Placeholder text (~line 726)
-   [ ] EmptyState.tsx - URL paste tip (~line 20)
-   [ ] Onboarding.tsx - Welcome message (~line 65)
-   [ ] Onboarding.tsx - Screenshot alt (~line 73)
-   [ ] Onboarding.tsx - API keys message (~line 97)
-   [ ] prompts.ts - System prompt (~line 245)
-   [ ] prompts.ts - About Chorus section (~line 257)
-   [ ] prompts.ts - Support email (~line 261)

### 2.5 Rust Backend

| File                          | Change                                               | Verification                            |
| ----------------------------- | ---------------------------------------------------- | --------------------------------------- |
| `src-tauri/src/lib.rs`        | `"about-chorus"` → `"about-camp"`                    | `grep -n "chorus" src-tauri/src/lib.rs` |
| `src-tauri/src/migrations.rs` | **KEEP** `'chorus::synthesize'` for DB compatibility | N/A (breaking change if modified)       |

### 2.6 Build Scripts

| File                       | Change                                                                                                               | Verification                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `script/dev-instance.sh`   | `sh.chorus.app.dev` → `ai.getcamp.app.dev`, "Chorus Dev" → "Camp Dev", `CHORUS_INSTANCE_NAME` → `CAMP_INSTANCE_NAME` | Run script, check identifier |
| `script/setup-instance.sh` | Same changes as above                                                                                                | Run script, check output     |

### 2.7 GitHub Workflows (CI/CD)

| File                                             | Change                                                         | Verification               |
| ------------------------------------------------ | -------------------------------------------------------------- | -------------------------- |
| `.github/workflows/cloud-publish.yaml`           | **DISABLE** until CrabNebula set up (rename to .yaml.disabled) | N/A                        |
| `.github/workflows/cloud-qa.yaml`                | **DISABLE** until CrabNebula set up                            | N/A                        |
| `.github/workflows/cloud-publish-migration.yaml` | **DELETE** (Chorus-specific migration)                         | N/A                        |
| `.github/workflows/release-notifier.yml`         | **DISABLE** until Slack webhook set up                         | N/A                        |
| `.github/workflows/lint-and-format.yml`          | **KEEP** (still useful)                                        | Push commit, check Actions |
| `.github/workflows/claude.yml`                   | **KEEP** or update API key                                     | N/A                        |

### 2.8 Documentation

| File           | Action                                                | Verification                 |
| -------------- | ----------------------------------------------------- | ---------------------------- |
| `README.md`    | Complete rewrite (see template below)                 | Visual review                |
| `CLAUDE.md`    | Update "What is Chorus?" → "What is Camp?" throughout | `grep -n "Chorus" CLAUDE.md` |
| `RELEASING.md` | Update for Camp release process (or mark as TODO)     | Visual review                |
| `LICENSE`      | Update copyright: "Copyright (c) 2025 Spark Capital"  | Visual review                |

**README.md Template**:

```markdown
# Camp

A multiplayer AI workspace for group projects.

## About

Camp is forked from [Chorus](https://github.com/meltylabs/chorus), an open-source
multi-model AI chat app by meltylabs. We're grateful to the Chorus team for
building such a solid foundation.

## Development

### Prerequisites

-   Node.js 22+
-   pnpm 9+
-   Rust (for Tauri)
-   ImageMagick (for icon generation): `brew install imagemagick`

### Setup

\`\`\`bash
pnpm install
pnpm run dev
\`\`\`

### Building

\`\`\`bash
pnpm tauri build
\`\`\`

### Verification

Run before committing changes:
\`\`\`bash
pnpm run camp:verify:quick # Fast check (debug build)
pnpm run camp:verify # Full check (both architectures)
\`\`\`

## Git Remotes

This repo uses two remotes:

-   `origin` - Camp repo (https://github.com/nabeelhyatt/camp)
-   `upstream` - Chorus repo (https://github.com/meltylabs/chorus)

**Important**: Always push to `origin`. Never push to `upstream`.

## Upstream Compatibility

We maintain backwards compatibility with Chorus where possible to facilitate
cherry-picking bug fixes and improvements from upstream. See
`docs/UPSTREAM-SYNC.md` for sync history.

## License

MIT License - Copyright (c) 2025 Spark Capital

See LICENSE file for details.
```

### 2.9 Assets

**Source icon**: Campfire PNG

The source icon should be committed to the repo for reproducibility:

```bash
# Copy source icon to repo
cp "/Users/nabeelhyatt/Library/Application Support/com.conductor.app/uploads/originals/4f774389-5fc0-4bfb-bfa8-b52e1610194f.png" assets/camp-icon-source.png
```

Create `script/build-icons.sh`:

```bash
#!/bin/bash
# Generate Camp app icons from source PNG
# Requires: ImageMagick (brew install imagemagick)
#
# Usage:
#   ./script/build-icons.sh                    # Use default source
#   ./script/build-icons.sh path/to/icon.png   # Use custom source

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Default to repo's source icon, fall back to original location
DEFAULT_SOURCE="$REPO_DIR/assets/camp-icon-source.png"
FALLBACK_SOURCE="$HOME/Library/Application Support/com.conductor.app/uploads/originals/4f774389-5fc0-4bfb-bfa8-b52e1610194f.png"

if [ -n "$1" ]; then
    SOURCE_ICON="$1"
elif [ -f "$DEFAULT_SOURCE" ]; then
    SOURCE_ICON="$DEFAULT_SOURCE"
else
    SOURCE_ICON="$FALLBACK_SOURCE"
fi

ICONS_DIR="$REPO_DIR/src-tauri/icons"

if ! command -v magick &> /dev/null; then
    echo "Error: ImageMagick not found. Install with: brew install imagemagick"
    exit 1
fi

if [ ! -f "$SOURCE_ICON" ]; then
    echo "Error: Source icon not found at: $SOURCE_ICON"
    echo "Please provide a source icon or copy it to: $DEFAULT_SOURCE"
    exit 1
fi

echo "Generating icons from: $SOURCE_ICON"
echo "Output directory: $ICONS_DIR"

# Standard sizes
magick "$SOURCE_ICON" -resize 32x32 "$ICONS_DIR/32x32.png"
magick "$SOURCE_ICON" -resize 128x128 "$ICONS_DIR/128x128.png"
magick "$SOURCE_ICON" -resize 256x256 "$ICONS_DIR/128x128@2x.png"
magick "$SOURCE_ICON" -resize 512x512 "$ICONS_DIR/icon.png"

# Windows sizes
magick "$SOURCE_ICON" -resize 30x30 "$ICONS_DIR/Square30x30Logo.png"
magick "$SOURCE_ICON" -resize 44x44 "$ICONS_DIR/Square44x44Logo.png"
magick "$SOURCE_ICON" -resize 71x71 "$ICONS_DIR/Square71x71Logo.png"
magick "$SOURCE_ICON" -resize 89x89 "$ICONS_DIR/Square89x89Logo.png"
magick "$SOURCE_ICON" -resize 107x107 "$ICONS_DIR/Square107x107Logo.png"
magick "$SOURCE_ICON" -resize 142x142 "$ICONS_DIR/Square142x142Logo.png"
magick "$SOURCE_ICON" -resize 150x150 "$ICONS_DIR/Square150x150Logo.png"
magick "$SOURCE_ICON" -resize 284x284 "$ICONS_DIR/Square284x284Logo.png"
magick "$SOURCE_ICON" -resize 310x310 "$ICONS_DIR/Square310x310Logo.png"
magick "$SOURCE_ICON" -resize 50x50 "$ICONS_DIR/StoreLogo.png"

# macOS .icns
echo "Generating macOS .icns..."
mkdir -p "$ICONS_DIR/icon.iconset"
magick "$SOURCE_ICON" -resize 16x16     "$ICONS_DIR/icon.iconset/icon_16x16.png"
magick "$SOURCE_ICON" -resize 32x32     "$ICONS_DIR/icon.iconset/icon_16x16@2x.png"
magick "$SOURCE_ICON" -resize 32x32     "$ICONS_DIR/icon.iconset/icon_32x32.png"
magick "$SOURCE_ICON" -resize 64x64     "$ICONS_DIR/icon.iconset/icon_32x32@2x.png"
magick "$SOURCE_ICON" -resize 128x128   "$ICONS_DIR/icon.iconset/icon_128x128.png"
magick "$SOURCE_ICON" -resize 256x256   "$ICONS_DIR/icon.iconset/icon_128x128@2x.png"
magick "$SOURCE_ICON" -resize 256x256   "$ICONS_DIR/icon.iconset/icon_256x256.png"
magick "$SOURCE_ICON" -resize 512x512   "$ICONS_DIR/icon.iconset/icon_256x256@2x.png"
magick "$SOURCE_ICON" -resize 512x512   "$ICONS_DIR/icon.iconset/icon_512x512.png"
magick "$SOURCE_ICON" -resize 1024x1024 "$ICONS_DIR/icon.iconset/icon_512x512@2x.png"
iconutil -c icns "$ICONS_DIR/icon.iconset" -o "$ICONS_DIR/icon.icns"
rm -rf "$ICONS_DIR/icon.iconset"

# Windows .ico
echo "Generating Windows .ico..."
magick "$SOURCE_ICON" -resize 256x256 -define icon:auto-resize=256,128,96,64,48,32,16 "$ICONS_DIR/icon.ico"

echo ""
echo "✅ Done! Icons generated in $ICONS_DIR"
echo ""
echo "To verify: ls -la $ICONS_DIR"
```

**Verification**:

```bash
chmod +x script/build-icons.sh
./script/build-icons.sh
ls -la src-tauri/icons/  # Should show updated timestamps
```

### 2.10 Analytics

**Decision: DISABLE for Phase 1**

Update `src/ui/main.tsx`:

```typescript
import "../polyfills";

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PostHogProvider } from "posthog-js/react";
import { campConfig } from "@core/campConfig";

const options = {
    api_host: "https://us.i.posthog.com",
};

window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
});

// Analytics disabled for Camp Phase 1
// TODO: Create Camp PostHog project and update campConfig.posthogKey
const analyticsEnabled = campConfig.posthogKey !== "";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        {analyticsEnabled ? (
            <PostHogProvider apiKey={campConfig.posthogKey} options={options}>
                <App />
            </PostHogProvider>
        ) : (
            <App />
        )}
    </React.StrictMode>,
);
```

**Verification**: Build app, open Network tab in dev tools, confirm no requests to posthog.com

---

## Phase 3: External Services & Infrastructure

### Current Dependencies on Chorus

| Service       | Current Value                           | Camp Value       | Status                     |
| ------------- | --------------------------------------- | ---------------- | -------------------------- |
| Backend proxy | `app.chorus.sh`                         | `app.getcamp.ai` | Keep Chorus for now        |
| GitHub OAuth  | `app.chorus.sh/auth/github_integration` | Same             | Keep Chorus for now        |
| Slack OAuth   | `app.chorus.sh/auth/slack`              | Same             | Keep Chorus for now        |
| PostHog       | Chorus project key                      | N/A              | **DISABLED**               |
| CrabNebula    | `chorus/chorus`                         | `camp/camp`      | Set up new account (later) |

### Secrets Inventory

**Secrets that need Camp equivalents (later)**:
| Secret | Used For | Location |
|--------|----------|----------|
| `CN_API_KEY` | CrabNebula Cloud uploads | GitHub Actions |
| `TAURI_SIGNING_PRIVATE_KEY` | App update signing | GitHub Actions |
| `APPLE_ID` | Notarization | GitHub Actions |
| `APPLE_PASSWORD` | Notarization | GitHub Actions |
| `APPLE_TEAM_ID` | Notarization | GitHub Actions |
| `APPLE_CERTIFICATE` | Code signing | GitHub Actions |
| `APPLE_CERTIFICATE_PASSWORD` | Code signing | GitHub Actions |

**Phase 1 Action**: Disable workflows that use these secrets. Do not attempt to use Chorus credentials.

### Backend Migration Plan (Future)

When ready to build Camp backend:

1. Deploy backend to `app.getcamp.ai`
2. Create GitHub OAuth app for Camp
3. Create Slack OAuth app for Camp
4. Update `campConfig.ts`: set `VITE_CAMP_BACKEND=camp`
5. Update `src-tauri/capabilities/default.json` permissions
6. Test all OAuth flows
7. Create Camp PostHog project, add key to `campConfig.ts`

---

## Phase 4: Implementation Order

### Step 1: Git Setup

```bash
git remote rename origin upstream
git remote add origin git@github.com:nabeelhyatt/camp.git
git push -u origin nabeelhyatt/context-box-ui:main
```

**Verify**: `git remote -v` shows both remotes

### Step 2: Copy Source Icon & Generate Icons

```bash
mkdir -p assets
cp "/Users/nabeelhyatt/Library/Application Support/com.conductor.app/uploads/originals/4f774389-5fc0-4bfb-bfa8-b52e1610194f.png" assets/camp-icon-source.png
chmod +x script/build-icons.sh
./script/build-icons.sh
```

**Verify**: `ls src-tauri/icons/` shows new files with recent timestamps

### Step 3: Core Config Files

1. Edit `package.json` - name, add `camp:verify` scripts
2. Edit `src-tauri/Cargo.toml` - name, description
3. Edit `src-tauri/tauri.conf.json` - productName, identifier, title, schemes
4. Edit `src-tauri/tauri.dev.conf.json` - same
5. Edit `src-tauri/tauri.qa.conf.json` - same
6. Edit `index.html` - title

**Verify**:

```bash
pnpm install
pnpm run typecheck
pnpm run dev  # Check window title says "Camp Dev"
```

### Step 4: Backend Config Centralization

1. Create `src/core/campConfig.ts` with environment-driven config
2. Update `src/core/chorus/toolsets/github.ts` to use campConfig
3. Update `src/core/chorus/toolsets/slack.ts` to use campConfig
4. Update `src/ui/main.tsx` to disable PostHog

**Verify**: `grep -r "app.chorus.sh" src/` only shows campConfig.ts

### Step 5: UI String Updates

Work through the UI String Tracking Checklist in section 2.4

**Verify**:

```bash
grep -r "Chorus" src/ui/ src/core/chorus/prompts/ --include="*.tsx" --include="*.ts"
# Should return nothing (or only comments/variable names)
grep -r "humans@chorus.sh" src/
# Should return nothing
```

### Step 6: Rust Updates

1. Edit `src-tauri/src/lib.rs` - about-chorus → about-camp

**Verify**: `cargo check`

### Step 7: Build Scripts

1. Edit `script/dev-instance.sh` - identifiers, names, env vars
2. Edit `script/setup-instance.sh` - same
3. Create `script/build-icons.sh`

**Verify**: `./script/dev-instance.sh test-instance` works, uses `ai.getcamp.app.dev.*`

### Step 8: Documentation & Legal

1. Rewrite `README.md` with Camp branding and contributor instructions
2. Update `CLAUDE.md` - replace all "Chorus" with "Camp"
3. Update `LICENSE` - "Copyright (c) 2025 Spark Capital"
4. Create `docs/UPSTREAM-SYNC.md`

**Verify**: `grep -rn "Chorus" README.md CLAUDE.md LICENSE` returns nothing (except attribution)

### Step 9: GitHub Workflows

1. Rename `cloud-publish.yaml` → `cloud-publish.yaml.disabled`
2. Rename `cloud-qa.yaml` → `cloud-qa.yaml.disabled`
3. Delete `cloud-publish-migration.yaml`
4. Rename `release-notifier.yml` → `release-notifier.yml.disabled`

### Step 10: Full Build Test

```bash
pnpm run camp:verify:quick  # Quick check
pnpm run camp:verify        # Full check (both architectures)
```

### Step 11: End-to-End Smoke Test

Manual QA pass:

-   [ ] **Launch**: App opens, window title says "Camp"
-   [ ] **Dock**: Campfire icon appears in dock
-   [ ] **Cmd+Tab**: Campfire icon in app switcher
-   [ ] **Deep link**: `open camp://` opens the app
-   [ ] **Quick chat**: Start a quick chat, send a message
-   [ ] **Settings**: Open settings, no "Chorus" visible, email shows nabeel@sparkcapital.com
-   [ ] **Onboarding**: If fresh install, onboarding says "Welcome to Camp"
-   [ ] **System prompt**: Start new chat, verify AI knows it's running in "Camp"
-   [ ] **GitHub OAuth**: Connect GitHub (should work via Chorus backend)
-   [ ] **Slack OAuth**: Connect Slack (should work via Chorus backend)
-   [ ] **MCP**: Add an MCP server, verify it connects
-   [ ] **Data directory**: Check `~/Library/Application Support/` uses `ai.getcamp.app*`

---

## Phase 5: Upstream Sync

### Recommended Cherry-picks

| Commit    | Description                 | Priority |
| --------- | --------------------------- | -------- |
| `c0e8495` | OpenAI SDK v4.96→v6.10      | High     |
| `a3da8f1` | TypeScript Uint8Array fixes | High     |
| `128187e` | Node 20→22                  | High     |
| `dd6529b` | Lint error fixes            | High     |
| `8b9104a` | Gemini 3 support            | Medium   |
| `a4c18b4` | Cost tracking               | Low      |

### Skip List

-   Chorus branding commits
-   CrabNebula migration commits
-   Chorus-specific feature commits

---

## Decisions Made

| Question          | Decision                                                      |
| ----------------- | ------------------------------------------------------------- |
| **Name**          | Camp                                                          |
| **GitHub**        | https://github.com/nabeelhyatt/camp                           |
| **Domain**        | getcamp.ai                                                    |
| **Backend**       | Keep `app.chorus.sh` for OAuth initially (env-var switchable) |
| **Distribution**  | Set up own CrabNebula account (later)                         |
| **Analytics**     | **DISABLED** - empty PostHog key                              |
| **Contact**       | nabeel@sparkcapital.com                                       |
| **Copyright**     | Spark Capital                                                 |
| **Upstream sync** | Weekly review, cherry-pick bug fixes                          |

---

## Appendix A: Full Grep Audit Commands

Run these after all changes to verify no Chorus references remain:

```bash
# UI strings (should be empty or only comments)
grep -rn "Chorus" src/ui/ src/core/chorus/prompts/ --include="*.tsx" --include="*.ts"

# Contact email (should be empty)
grep -rn "humans@chorus.sh" .

# Bundle identifiers (should only show ai.getcamp.app)
grep -rn "sh.chorus.app" . --include="*.json" --include="*.sh"

# Deep link schemes (should show camp://)
grep -rn '"chorus"' src-tauri/ --include="*.json"

# Window titles
grep -rn "title.*Chorus" . --include="*.json" --include="*.html"

# Backend URLs (should only be in campConfig.ts)
grep -rn "app.chorus.sh" src/
```

## Appendix B: Data Directory Migration

If a user has both Chorus and Camp installed, they will have separate data:

-   Chorus: `~/Library/Application Support/sh.chorus.app/`
-   Camp: `~/Library/Application Support/ai.getcamp.app/`

**To start Camp fresh** (remove any test data):

```bash
rm -rf ~/Library/Application\ Support/ai.getcamp.app*
```

**Note**: Camp does NOT automatically migrate Chorus data. Users who want to keep their chats should continue using Chorus or manually copy the database.

## Appendix C: Debugging

### Verbose Mode

Set environment variable for additional logging:

```bash
CAMP_DEBUG=1 pnpm run dev
```

### Check Current Backend

The app logs which backend it's using on startup. Check the console for:

```
[Camp] Using backend: chorus (https://app.chorus.sh)
```

### Version Info

Version is displayed in Settings. Also available via:

```bash
# Check Tauri version
grep '"version"' src-tauri/tauri.conf.json
```
