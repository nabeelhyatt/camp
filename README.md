<p align="center">
  <img src="app-icon.png" alt="Camp icon" width="128" />
</p>

<h1 align="center"><a href="https://getcamp.ai">Camp</a></h1>

<p align="center">Multiplayer AI workspace for group projects. Fork of <a href="https://chorus.sh">Chorus</a>.</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/771262eb-5a0e-40cb-b1a5-9df6b903c626" alt="Camp screenshot" />
</p>

## Table of Contents

- [Orientation](#orientation)
  - [Quick Start](#quick-start)
  - [Platform Overview](#platform-overview)
  - [Project Structure](#project-structure)
  - [Further Documentation](#further-documentation)
- [Platform & Architecture](#platform--architecture)
  - [Tech Stack](#tech-stack)
  - [Backend Integration](#backend-integration)
  - [Data Storage](#data-storage)
- [Development Workflow](#development-workflow)
  - [Branch-First Development](#branch-first-development)
  - [Issue-Driven Development](#issue-driven-development)
  - [Code Quality & Standards](#code-quality--standards)
- [Roadmap](#roadmap)

## Orientation

### Quick Start

**Prerequisites:**
1. NodeJS installed and on your path
2. Rust and Cargo installed (verify with `rustc --version`, `cargo --version`)
3. `pnpm` (`brew install pnpm`)
4. `git-lfs` (`brew install git-lfs`)
5. `imagemagick` (optional, for custom dev icons)

**Setup:**
```bash
# One-time setup
git lfs install --force
git lfs pull
pnpm run setup              # Install dependencies and configure instance

# Development
pnpm run dev                # Start Tauri dev server

# Access points:
# App: http://localhost:14XX (random even port 1422-1522)
```

**Instance Isolation:**
Each checkout gets its own isolated data directory based on the folder name. This allows multiple development instances to run simultaneously without conflicts.

### Platform Overview

Camp is a native Mac application for AI-powered chat with multiplayer capabilities:

**Current Features:**
- Multi-model chat (Claude, GPT-4, Gemini, etc. in parallel)
- MCP (Model Context Protocol) support
- Ambient chats (system-wide quick access)
- Projects for organizing related chats
- Bring your own API keys

**Planned (Multiplayer):**
- Team workspaces with shared chats
- Real-time presence and collaboration
- Cross-device sync via Convex
- Google authentication via Clerk

### Project Structure

```
camp/
├── src/
│   ├── ui/                    # React frontend
│   │   ├── components/        # UI components
│   │   │   ├── AppSidebar.tsx # Main navigation
│   │   │   ├── MultiChat.tsx  # Chat interface
│   │   │   ├── ChatInput.tsx  # Message input
│   │   │   └── ...
│   │   ├── App.tsx            # Root component + routing
│   │   └── lib/               # UI utilities
│   └── core/
│       ├── chorus/            # Core business logic (from upstream)
│       │   ├── api/           # TanStack Query hooks
│       │   ├── db/            # SQLite queries
│       │   ├── Models.ts      # Model definitions
│       │   └── ModelProviders/ # Provider implementations
│       └── campConfig.ts      # Camp-specific configuration
├── src-tauri/
│   ├── src/
│   │   ├── main.rs            # Tauri entry point
│   │   └── migrations.rs      # SQLite migrations
│   └── tauri.conf.json        # Tauri configuration
├── docs/                      # Documentation
│   ├── MULTIPLAYER-SPEC.md    # Multiplayer migration spec
│   ├── PRD-GOOGLE-AUTH.md     # Authentication PRD
│   └── ...
└── .context/                  # AI agent context files
```

### Further Documentation

- [CLAUDE.md](CLAUDE.md) - AI agent instructions and coding guidelines
- [UPSTREAM-SYNC.md](UPSTREAM-SYNC.md) - Policy for syncing with Chorus upstream
- [docs/MULTIPLAYER-SPEC.md](docs/MULTIPLAYER-SPEC.md) - Multiplayer migration specification
- [docs/PRD-GOOGLE-AUTH.md](docs/PRD-GOOGLE-AUTH.md) - Google authentication PRD

## Platform & Architecture

### Tech Stack

**Tauri 2.0** - Native desktop app with Rust backend and web frontend

**React + TypeScript** - UI layer with strict typing throughout

**TanStack Query** - Server state management and caching

**SQLite** - Local data storage (transitioning to Convex for multiplayer)

**Tailwind CSS** - Utility-first styling

**Vite** - Fast development builds with HMR

This stack prioritizes stability and developer experience over bleeding-edge features.

### Backend Integration

Camp uses multiple backend services:

**Chorus Backend** (`app.chorus.sh`)
- Model API proxying
- Billing and usage tracking
- Account management

**Convex** (planned for multiplayer)
- Real-time data sync
- Cloud storage for chats/messages
- Presence and collaboration

**Clerk** (planned for auth)
- Google OAuth
- Session management
- User profiles

### Data Storage

**Current (Local-Only):**
- All data in local SQLite (`~/Library/Application Support/ai.getcamp.app.dev.{instance}/chats.db`)
- Device ID generated on first launch
- No cross-device sync

**Planned (Multiplayer):**
- Convex as source of truth
- SQLite as read cache
- Real-time sync across devices
- User attribution on all data

## Development Workflow

### Branch-First Development

**Core Principle: Never Develop in Main**

1. **Create GitHub Issue** - Describe what needs to be done
2. **Create Feature Branch** - Format: `nabeelhyatt/feature-name` or `claude/feature-name`
3. **Develop in Branch** - Commit frequently, test early
4. **Create Pull Request** - Include test plan
5. **Merge and Cleanup** - Delete feature branch after merge

**Key Commands:**
```bash
git checkout main && git pull
git checkout -b nabeelhyatt/my-feature
# ... develop ...
git add -A
git commit -m "feat: add feature"
git push -u origin nabeelhyatt/my-feature
# Create PR via GitHub
```

### Issue-Driven Development

GitHub issues drive all development work. Significant features include:

```markdown
## Problem
What we're solving and why

## Solution
Desired outcome and user benefit

## Acceptance Criteria
- [ ] Specific, testable requirements

## Technical Notes
- Files to modify
- Database changes needed
```

**When to Create Issues:**
- New features
- Bug fixes requiring investigation
- Refactoring multiple files
- Database schema changes

**Skip Issues For:**
- Typo fixes
- Simple one-line changes

### Code Quality & Standards

**Commit Standards:**
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
- Explain what and why, not just what's in the diff

**TypeScript:**
- Avoid `any` types - use explicit typing
- Leverage existing type definitions
- Prefer `undefined` over `null`

**Migrations:**
- NEVER edit existing migration files
- Create new migrations to fix issues
- Test with app restart before committing

**Upstream Compatibility:**
- Check `UPSTREAM-SYNC.md` before modifying `src/core/chorus/` files
- Tier 1 files should never be modified
- Camp customizations go in `campConfig.ts` or new files

## Roadmap

### Phase 1: Authentication + Data Sync (Current)
- [ ] Clerk integration with Google OAuth
- [ ] Convex schema deployment
- [ ] User/org/workspace auto-creation
- [ ] Migrate chats to Convex storage

### Phase 2: Multiplayer
- [ ] Workspace switcher UI
- [ ] Real-time presence indicators
- [ ] Team invitations via email
- [ ] Streaming to multiple viewers

See [docs/MULTIPLAYER-SPEC.md](docs/MULTIPLAYER-SPEC.md) for detailed specifications.

---

## Team

- **Nabeel**: Developer

## License

Private - Camp

## Upstream

Camp is a fork of [Chorus](https://github.com/meltylabs/chorus). See [UPSTREAM-SYNC.md](UPSTREAM-SYNC.md) for our policy on cherry-picking upstream fixes.
