// Camp configuration - centralized backend and analytics settings
// Use VITE_CAMP_BACKEND env var to switch backends:
// - "chorus" (default): Use Chorus backend at app.chorus.sh
// - "camp": Use Camp backend at app.getcamp.ai (Phase 2)

const isDev: boolean = import.meta.env.DEV;

// Backend selection - defaults to "chorus" for Phase 1
type BackendType = "chorus" | "camp";
const envBackend = import.meta.env.VITE_CAMP_BACKEND as string | undefined;
const CAMP_BACKEND: BackendType =
    envBackend === "camp" || envBackend === "chorus" ? envBackend : "chorus";

const BACKEND_URLS: Record<BackendType, string> = {
    chorus: "https://app.chorus.sh",
    camp: "https://app.getcamp.ai",
};

const CAMP_PROXY_URL: string =
    BACKEND_URLS[CAMP_BACKEND] || BACKEND_URLS.chorus;

// Analytics - disabled for Phase 1
// TODO: Create Camp PostHog project and add key here
const POSTHOG_KEY = "";

// Multiplayer configuration (required)
const CONVEX_URL: string | undefined = import.meta.env.VITE_CONVEX_URL as
    | string
    | undefined;
const CLERK_PUBLISHABLE_KEY: string | undefined = import.meta.env
    .VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

if (!CONVEX_URL) {
    throw new Error("Missing VITE_CONVEX_URL environment variable");
}
if (!CLERK_PUBLISHABLE_KEY) {
    throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

// Default OpenRouter API key for new users (optional)
// This provides a fallback so users can try models before setting up their own keys
const DEFAULT_OPENROUTER_KEY: string | undefined = import.meta.env
    .VITE_DEFAULT_OPENROUTER_KEY as string | undefined;

// Default Firecrawl API key for URL scraping (optional)
// This provides a fallback so users can auto-scrape URLs before setting up their own keys
const DEFAULT_FIRECRAWL_KEY: string | undefined = import.meta.env
    .VITE_DEFAULT_FIRECRAWL_KEY as string | undefined;

// Data layer selection - use Convex for multiplayer sync
// Set VITE_USE_CONVEX_DATA=false to fall back to SQLite (for debugging)
const USE_CONVEX_DATA: boolean =
    import.meta.env.VITE_USE_CONVEX_DATA !== "false";

export const campConfig = {
    isDev,
    backend: CAMP_BACKEND,
    proxyUrl: CAMP_PROXY_URL,
    githubAuthUrl: `${CAMP_PROXY_URL}/auth/github_integration`,
    slackAuthUrl: `${CAMP_PROXY_URL}/auth/slack`,
    posthogKey: POSTHOG_KEY,
    isUsingChorusBackend: CAMP_BACKEND === "chorus",

    // Multiplayer (required)
    convexUrl: CONVEX_URL,
    clerkPublishableKey: CLERK_PUBLISHABLE_KEY,

    // Default API keys (optional)
    defaultOpenRouterKey: DEFAULT_OPENROUTER_KEY,
    defaultFirecrawlKey: DEFAULT_FIRECRAWL_KEY,

    // Data layer - Convex for multiplayer, SQLite for fallback
    useConvexData: USE_CONVEX_DATA,
} as const;
