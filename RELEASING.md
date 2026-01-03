# Releasing Camp

## Quick Start

To release a new version of Camp:

```bash
pnpm run release
```

That's it!

## What Happens

The release script (`script/release.sh`) does the following:

1. Runs TypeScript compilation to check for errors
2. Checks out `main` and pulls the latest changes
3. Checks out the `release` branch
4. Pulls `main` into `release` (fast-forward merge)
5. Pushes `release` to GitHub
6. Switches back to `main`

Once the `release` branch is pushed, GitHub Actions automatically:

1. Creates a draft release on CrabNebula Cloud
2. Builds the app for Intel (`x86_64`) and Apple Silicon (`aarch64`) Macs, plus Windows and Linux
3. Signs and notarizes the macOS app with Apple (requires credentials)
4. Uploads the build artifacts to CrabNebula Cloud

Next, you need to publish the release on CrabNebula Cloud:

## Publishing

1. Go to the draft release on [CrabNebula Cloud](https://web.crabnebula.cloud/nabeel-hyatt/camp)
2. Click "Publish release"

## Monitoring

Check release status at: https://github.com/nabeelhyatt/camp/actions

---

## First-Time Setup

Before your first release, you need to configure:

### 1. GitHub Repository Secrets

Go to your repo → Settings → Secrets and variables → Actions, and add:

| Secret                               | Description                       |
| ------------------------------------ | --------------------------------- |
| `CN_API_KEY`                         | CrabNebula Cloud API token        |
| `TAURI_SIGNING_PRIVATE_KEY`          | Updater signing key (from `.env`) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | (optional, if key has password)   |

### 2. Apple Code Signing (for signed/notarized macOS builds)

| Secret                       | Description                                          |
| ---------------------------- | ---------------------------------------------------- |
| `APPLE_CERTIFICATE`          | Base64-encoded .p12 certificate                      |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password                                 |
| `APPLE_SIGNING_IDENTITY`     | e.g., "Developer ID Application: Your Name (TEAMID)" |
| `APPLE_ID`                   | Apple ID email                                       |
| `APPLE_PASSWORD`             | App-specific password                                |
| `APPLE_TEAM_ID`              | 10-character team ID                                 |

To create an app-specific password: https://support.apple.com/en-us/102654

### 3. Create Release Branch

If the `release` branch doesn't exist:

```bash
git checkout main
git checkout -b release
git push -u origin release
```

---

## Local Build (Unsigned)

For testing, you can build locally:

```bash
pnpm install
pnpm tauri build
```

The unsigned app will be at `src-tauri/target/release/bundle/macos/Camp.app`.

Note: Unsigned builds will show macOS security warnings. To distribute to others, use the CrabNebula release process for proper signing.
