# Upstream Sync Policy

Camp is a fork of [Chorus](https://github.com/meltylabs/chorus). This document describes our policy for syncing with the upstream repository.

## Git Remote Configuration

- `origin` - Camp repository (github.com/nabeelhyatt/camp)
- `upstream` - Chorus repository (github.com/meltylabs/chorus)

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
- Bug fixes
- Security patches
- Model provider updates
- Performance improvements
- MCP protocol updates

**Don't cherry-pick:**
- Branding changes
- Features that conflict with Camp's direction
- Changes to the Chorus backend integration (we maintain our own)

## Handling Conflicts

When cherry-picking causes conflicts:

1. Resolve conflicts preserving Camp branding
2. Test thoroughly after resolution
3. Document any significant deviations from upstream

## Tracking Upstream

Keep track of the last upstream commit we've reviewed:

**Last reviewed upstream commit:** (initial fork)

Update this when reviewing upstream changes.
