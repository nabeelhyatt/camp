# Conductor Setup Script Specification

## Problem Statement

Conductor needs to run setup and dev scripts for the Camp project. The scripts must work in Conductor's execution environment, which may have limited PATH and tool availability.

## Current Issues

1. **pnpm not in PATH**: When Conductor runs scripts, `pnpm` command is not found even though it may be installed on the system
2. **Inconsistent package manager**: Previous attempt to use npm fails due to peer dependency conflicts
3. **Setup must be idempotent**: Running setup multiple times should be safe
4. **Dev script must handle existing processes**: If dev is already running, should either error clearly or handle gracefully

## Requirements

### 1. Package Manager Strategy

**Decision: Use npx corepack to run pnpm**

Rationale:
- pnpm-lock.yaml already exists in the repo
- pnpm handles the `use-react-query-auto-sync` peer dependency gracefully (already resolved in lock file)
- `npx corepack pnpm` works even when pnpm is not in PATH
- corepack ships with Node.js 16.9+, so it's available
- Avoids package manager switching churn
- Developers can continue using pnpm locally

Alternative: Use npm with --legacy-peer-deps
- Would require switching from pnpm to npm
- Would need to update .npmrc
- Unnecessary churn when npx corepack solves the PATH issue

### 2. Setup Script (`conductor.json` -> `setup`)

The setup script must:
- ✅ Use `npx corepack pnpm` to ensure pnpm is available
- ✅ Run `npx corepack pnpm install` to install dependencies
- ✅ Create application support directories
- ✅ Copy auth.dat if available from main Camp instance
- ✅ Copy chats.db if available from main Camp instance
- ✅ Generate custom icon if ImageMagick is available (optional)
- ✅ Be idempotent - safe to run multiple times
- ✅ Print clear success message
- ✅ Handle missing optional dependencies gracefully

### 3. Dev/Run Script (`conductor.json` -> `run`)

The dev script must:
- ✅ Use `npx corepack pnpm` for all pnpm commands
- ✅ Check that node_modules exists (fail fast if setup wasn't run)
- ✅ Use unique app identifier based on workspace directory name
- ✅ Calculate unique port based on workspace name
- ✅ Start Convex dev server in background
- ✅ Start Tauri dev with custom config
- ✅ Clean up background processes on exit
- ✅ Handle custom icons if available

### 4. Files to Modify

1. **`conductor.json`**: Update to use `npx corepack pnpm run setup`
2. **`script/setup-instance.sh`**: Update to use `npx corepack pnpm install`
3. **`script/dev-instance.sh`**: Update to use `npx corepack pnpm run` commands
4. **`CLAUDE.md`**: No changes needed - already documents pnpm usage

### 5. Configuration Files

**`.npmrc`** - No changes needed (current config is fine for pnpm)

**`conductor.json`** should contain:
```json
{
    "scripts": {
        "setup": "npx --yes corepack pnpm run setup",
        "run": "./script/dev-instance.sh"
    }
}
```

### 6. Script Implementation Details

**setup-instance.sh**:
- Use `npx --yes corepack pnpm install`
- Keep all other functionality the same

**dev-instance.sh**:
- Use `npx --yes corepack pnpm run` commands
- Error message should say "Please run Conductor setup first"
- Keep all other functionality the same

### 7. Testing Checklist

- [ ] Fresh Conductor workspace setup completes successfully
- [ ] Setup is idempotent (can run multiple times safely)
- [ ] Dev server starts correctly
- [ ] Custom icons work (if ImageMagick available)
- [ ] Multiple workspace instances can run simultaneously with different ports
- [ ] Cleanup on exit works correctly
- [ ] Works with and without existing auth.dat/chats.db

## Why npx corepack instead of adding to PATH?

We could add common pnpm paths to the script's PATH, but:
- pnpm can be installed in many locations (homebrew, npm global, corepack, volta, etc.)
- `npx corepack` is guaranteed to work regardless of how pnpm was installed
- corepack ships with Node.js 16.9+, so it's universally available
- Simpler and more reliable than PATH manipulation

## Summary

Use `npx --yes corepack pnpm` for all pnpm commands in Conductor scripts. This ensures pnpm is available regardless of PATH configuration, works with the existing pnpm-lock.yaml, and handles peer dependencies gracefully.
