# Upstream Sync Policy

Camp is a fork of [Chorus](https://github.com/meltylabs/chorus). This document describes our policy for syncing with the upstream repository and which files should remain upstream-compatible.

## Git Remote Configuration

-   `origin` - Camp repository (github.com/nabeelhyatt/camp)
-   `upstream` - Chorus repository (github.com/meltylabs/chorus)

## Cherry-Picking Upstream Changes

When Chorus releases bug fixes or features we want, we cherry-pick specific commits rather than merging entire branches:

```bash
# Fetch latest from upstream
git fetch upstream

# View recent upstream commits
git log upstream/main --oneline -20

# Cherry-pick specific commits
git cherry-pick <commit-hash>
```

## What to Cherry-Pick

**Do cherry-pick:**

-   Bug fixes
-   Security patches
-   Model provider updates (new models, API changes)
-   Performance improvements
-   MCP protocol updates
-   Chat logic improvements
-   UI component fixes (shadcn/ui updates)

**Don't cherry-pick:**

-   Branding changes
-   Features that conflict with Camp's direction
-   Changes to Chorus-specific backend URLs (we use `campConfig.ts`)
-   Analytics/telemetry changes (we have our own config)

---

## File Classification: Upstream Compatibility

### Tier 1: NEVER MODIFY (Upstream-Critical)

These files are the core of Chorus and change frequently upstream. Keep them untouched to enable easy cherry-picks:

**Model Providers** - `src/core/chorus/ModelProviders/`

-   `IProvider.ts` - Provider interface
-   `ProviderAnthropic.ts` - Claude models
-   `ProviderOpenAI.ts` - GPT models
-   `ProviderGoogle.ts` - Gemini
-   `ProviderGrok.ts` - xAI
-   `ProviderPerplexity.ts`
-   `ProviderOpenRouter.ts`
-   `ProviderOllama.ts`
-   `ProviderLMStudio.ts`

**Core Chat Logic** - `src/core/chorus/`

-   `ChatState.ts` - Message/conversation structure
-   `Models.ts` - Model catalog and types
-   `Toolsets.ts` - Tool/MCP definitions
-   `ToolsetsManager.ts` - Toolset lifecycle
-   `MCPStdioTauri.ts` - MCP implementation for Tauri

**Database Schema** - `src-tauri/src/`

-   `migrations.rs` - Only ADD new migrations, never modify existing

**UI Primitives** - `src/ui/components/ui/`

-   All shadcn/ui components (button, dialog, sidebar, etc.)
-   These are generic and upstream-maintained

### Tier 2: CHERRY-PICK CAREFULLY

These files contain generic logic but may have Camp-specific touches:

**API Layer** - `src/core/chorus/api/`

-   `ChatAPI.ts`, `MessageAPI.ts`, `ProjectAPI.ts`, etc.
-   Generic query/mutation code, but verify backend URL usage

**Main Components** - `src/ui/components/`

-   `MultiChat.tsx` - Core chat interface
-   `ChatInput.tsx` - Input handling
-   `ManageModelsBox.tsx` - Model picker (changes frequently upstream)
-   `ToolsBox.tsx` - Tool management
-   `CommandMenu.tsx` - Global shortcuts

### Tier 3: SAFE TO CUSTOMIZE (Camp-Specific)

These files are our customization layer - modify freely:

**Camp Configuration**

-   `src/core/campConfig.ts` - Backend URLs, feature flags
-   `src/core/config.ts` - Consumes campConfig

**Branding & Onboarding**

-   `src/ui/components/Onboarding.tsx` - Welcome flow
-   `src/ui/components/Settings.tsx` - Settings UI
-   `src/ui/components/Home.tsx` - Landing page

**Camp-Specific Features**

-   `src/ui/components/ProjectView.tsx` - Group Projects UI
-   Any new components we add

**Assets**

-   `src-tauri/icons/`, `icons-dev/`, `icons-qa/` - Camp icons
-   `app-icon.png` - Camp logo

---

## Architecture for Easy Upstream Sync

```
┌─────────────────────────────────────────────────────────┐
│                    TIER 1: UPSTREAM                      │
│  Model Providers │ MCP │ ChatState │ UI Primitives      │
│              (Never modify - cherry-pick freely)         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 TIER 2: ABSTRACTION LAYER               │
│         API Layer │ Main Components │ Hooks             │
│           (Cherry-pick with care, check for conflicts)  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  TIER 3: CAMP LAYER                     │
│    campConfig.ts │ Branding │ Custom Features           │
│              (Our code - modify freely)                  │
└─────────────────────────────────────────────────────────┘
```

**Key Principle**: All Camp customizations should flow through `campConfig.ts` or live in Tier 3 files. This keeps Tier 1 files pristine for upstream updates.

---

## Handling Conflicts

When cherry-picking causes conflicts:

1. Resolve conflicts preserving Camp branding in Tier 3 files
2. For Tier 1/2 conflicts, prefer upstream version unless it breaks Camp
3. Test thoroughly after resolution
4. Document any significant deviations in this file

## Tracking Upstream

Keep track of the last upstream commit we've reviewed:

**Last reviewed upstream commit:** (initial fork)

Update this when reviewing upstream changes.

---

## Common Upstream Update Scenarios

### New Model Added

1. Cherry-pick the `Models.ts` changes
2. Cherry-pick any provider updates
3. Should apply cleanly (Tier 1)

### UI Component Bug Fix

1. Cherry-pick the `src/ui/components/ui/` changes
2. Should apply cleanly (Tier 1)

### Chat Logic Improvement

1. Cherry-pick `ChatState.ts` or API changes
2. Test thoroughly - may affect Camp features
3. Check for `campConfig` integration needs

### MCP Protocol Update

1. Cherry-pick `MCPStdioTauri.ts` and `Toolsets.ts`
2. Test all tool integrations
3. Critical for maintaining tool compatibility
