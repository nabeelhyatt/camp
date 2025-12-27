// Camp configuration - centralized backend and analytics settings
// Use VITE_CAMP_BACKEND env var to switch backends:
// - "chorus" (default): Use Chorus backend at app.chorus.sh
// - "camp": Use Camp backend at app.getcamp.ai (Phase 2)

const isDev = import.meta.env.DEV;

// Backend selection - defaults to "chorus" for Phase 1
type BackendType = "chorus" | "camp";
const CAMP_BACKEND: BackendType =
    (import.meta.env.VITE_CAMP_BACKEND as BackendType) || "chorus";

const BACKEND_URLS: Record<BackendType, string> = {
    chorus: "https://app.chorus.sh",
    camp: "https://app.getcamp.ai",
};

const CAMP_PROXY_URL = BACKEND_URLS[CAMP_BACKEND] || BACKEND_URLS.chorus;

// Analytics - disabled for Phase 1
// TODO: Create Camp PostHog project and add key here
const POSTHOG_KEY = "";

// Multiplayer configuration
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
const MULTIPLAYER_ENABLED =
    import.meta.env.VITE_MULTIPLAYER_ENABLED === "true";

export const campConfig = {
    isDev,
    backend: CAMP_BACKEND,
    proxyUrl: CAMP_PROXY_URL,
    githubAuthUrl: `${CAMP_PROXY_URL}/auth/github_integration`,
    slackAuthUrl: `${CAMP_PROXY_URL}/auth/slack`,
    posthogKey: POSTHOG_KEY,
    isUsingChorusBackend: CAMP_BACKEND === "chorus",

    // Multiplayer (Phase 1)
    convexUrl: CONVEX_URL,
    clerkPublishableKey: CLERK_PUBLISHABLE_KEY,
    multiplayerEnabled: MULTIPLAYER_ENABLED,
    isMultiplayerConfigured: Boolean(CONVEX_URL && CLERK_PUBLISHABLE_KEY),
} as const;
