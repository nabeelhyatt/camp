# Camp - Phase 2 PRD (Distribution & Infrastructure)

## Overview

Phase 2 focuses on setting up Camp's independent infrastructure for distribution, analytics, and backend services. This phase should begin after Phase 1 (rebrand) is complete and verified.

**Prerequisites**: Phase 1 complete (all exit criteria passed)

---

## Phase 2 Exit Criteria

-   [ ] Camp backend deployed at `app.getcamp.ai`
-   [ ] GitHub OAuth app created and working
-   [ ] Slack OAuth app created and working
-   [ ] CrabNebula account set up with Camp app
-   [ ] Apple Developer certificates/signing configured
-   [ ] Auto-update working via CrabNebula
-   [ ] PostHog project created (optional)
-   [ ] First signed/notarized Camp release published

---

## 2.1 Domain & Backend Setup

### Domain Configuration

-   [ ] Verify `getcamp.ai` domain ownership
-   [ ] Set up DNS for `app.getcamp.ai` (backend)
-   [ ] Set up DNS for `getcamp.ai` (marketing site, if needed)
-   [ ] SSL certificates configured

### Backend Deployment

The Chorus backend is written in Elixir and handles:

-   OAuth callbacks for GitHub/Slack integrations
-   User accounts (if needed)
-   API key proxying (optional)

**Options**:

1. **Fork Chorus backend** - If available/open-source
2. **Build minimal backend** - Just OAuth callbacks
3. **Use third-party OAuth** - Auth0, Clerk, etc.

**Required endpoints**:

-   `GET /auth/github_integration` - GitHub OAuth callback
-   `GET /auth/slack` - Slack OAuth callback

### Configuration Update

Once backend is ready, update `src/core/campConfig.ts`:

```typescript
// Change default from "chorus" to "camp"
const CAMP_BACKEND = import.meta.env.VITE_CAMP_BACKEND || "camp";
```

And update `src-tauri/capabilities/default.json` to allow `app.getcamp.ai`.

---

## 2.2 OAuth App Setup

### GitHub OAuth App

1. Go to GitHub Developer Settings → OAuth Apps → New OAuth App
2. Configure:
    - Application name: `Camp`
    - Homepage URL: `https://getcamp.ai`
    - Authorization callback URL: `https://app.getcamp.ai/auth/github_integration`
3. Save Client ID and Client Secret
4. Add to Camp backend environment

### Slack OAuth App

1. Go to Slack API → Create New App
2. Configure:
    - App Name: `Camp`
    - Redirect URLs: `https://app.getcamp.ai/auth/slack`
3. Configure scopes (match Chorus scopes)
4. Save Client ID and Client Secret
5. Add to Camp backend environment

---

## 2.3 CrabNebula Setup

### Account Creation

1. Create account at [CrabNebula Cloud](https://crabnebula.dev/)
2. Create new application: `camp`
3. Note the application ID for workflows

### GitHub Secrets

Add to `github.com/nabeelhyatt/camp` → Settings → Secrets:

| Secret                      | Description                       |
| --------------------------- | --------------------------------- |
| `CN_API_KEY`                | CrabNebula API key                |
| `TAURI_SIGNING_PRIVATE_KEY` | Generate new key for Camp updates |

### Update Workflows

Re-enable and update `.github/workflows/cloud-publish.yaml`:

```yaml
env:
    CN_APPLICATION: "camp/camp" # Update from chorus/chorus
```

---

## 2.4 Apple Developer Setup

### Requirements

-   Apple Developer account ($99/year)
-   Create App ID for `ai.getcamp.app`
-   Generate signing certificates
-   Configure notarization

### GitHub Secrets

| Secret                       | Description                     |
| ---------------------------- | ------------------------------- |
| `APPLE_ID`                   | Apple Developer email           |
| `APPLE_PASSWORD`             | App-specific password           |
| `APPLE_TEAM_ID`              | Team ID from Apple Developer    |
| `APPLE_CERTIFICATE`          | Base64-encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password            |

### Tauri Updater Key

Generate new signing key for Camp:

```bash
pnpm tauri signer generate -w ~/.tauri/camp.key
```

Update `src-tauri/tauri.conf.json` with new public key.

---

## 2.5 Analytics (Optional)

### PostHog Setup

1. Create account at [PostHog](https://posthog.com/)
2. Create new project: `Camp`
3. Get project API key
4. Update `src/core/campConfig.ts`:

```typescript
const POSTHOG_KEY = "phc_YOUR_CAMP_KEY_HERE";
```

### Alternative: Disable Analytics

If analytics not needed, leave `POSTHOG_KEY = ""` in campConfig.

---

## 2.6 Release Workflow

### First Release Checklist

-   [ ] All Phase 1 exit criteria passed
-   [ ] CrabNebula account configured
-   [ ] Apple signing configured
-   [ ] Tauri updater key generated
-   [ ] GitHub secrets added
-   [ ] `cloud-publish.yaml` re-enabled and updated
-   [ ] Test build on both architectures
-   [ ] Publish first release

### Release Process

```bash
# 1. Verify everything passes
pnpm run camp:verify

# 2. Create release branch (if using release branch strategy)
git checkout -b release
git push origin release

# 3. GitHub Actions builds and uploads to CrabNebula

# 4. Publish on CrabNebula dashboard
```

---

## Timeline Estimate

| Task                  | Estimated Effort                |
| --------------------- | ------------------------------- |
| Domain/DNS setup      | 1 hour                          |
| Backend deployment    | 2-8 hours (depends on approach) |
| GitHub OAuth app      | 30 min                          |
| Slack OAuth app       | 30 min                          |
| CrabNebula setup      | 1 hour                          |
| Apple Developer setup | 2-4 hours                       |
| First release         | 2 hours                         |

**Total**: ~1-2 days (excluding backend if building from scratch)

---

## Open Questions for Phase 2

1. **Backend approach**: Fork Chorus backend, build minimal, or use third-party OAuth?
2. **User accounts**: Does Camp need user accounts, or just API keys?
3. **Analytics**: Enable PostHog or stay analytics-free?
4. **Marketing site**: Need a landing page at getcamp.ai?

---

## Dependencies on Phase 1

Phase 2 cannot start until:

-   Bundle identifiers updated (`ai.getcamp.app`)
-   Deep link schemes updated (`camp://`)
-   All UI strings rebranded
-   `campConfig.ts` created with env-var switching
-   GitHub workflows disabled (ready to re-enable with new config)
