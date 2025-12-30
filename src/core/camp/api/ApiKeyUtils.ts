/**
 * API Key Utilities for Camp Multiplayer
 *
 * Handles client-side encryption of API keys before storing in Convex.
 * Decryption happens server-side in HTTP actions.
 *
 * Security model:
 * - Keys are encrypted with AES-GCM using a shared secret
 * - The shared secret is stored in Convex environment variables (ENCRYPTION_KEY)
 * - For simplicity in Phase 0, we use base64 encoding as a placeholder
 * - TODO: Implement proper AES-GCM encryption in production
 */

/**
 * Extract the last N characters of a key for display hint
 * Returns "••••XXXX" format
 */
export function getKeyHint(key: string, visibleChars = 4): string {
    if (!key || key.length < visibleChars) {
        return "••••";
    }
    const lastChars = key.slice(-visibleChars);
    return `••••${lastChars}`;
}

/**
 * Validate that a string looks like an API key
 * Basic validation - checks length and format
 */
export function isValidApiKey(key: string): boolean {
    if (!key || typeof key !== "string") {
        return false;
    }

    const trimmed = key.trim();

    // Most API keys are at least 20 characters
    if (trimmed.length < 20) {
        return false;
    }

    // Check for common prefixes that indicate API keys
    const validPrefixes = [
        "sk-", // OpenAI, Anthropic
        "pk-", // Some providers
        "key-", // Generic
        "API", // Some formats
        "Bearer", // If accidentally included
    ];

    // If it has a known prefix, it's likely valid
    // If not, it might still be valid (Google, etc. use different formats)
    const hasKnownPrefix = validPrefixes.some((prefix) =>
        trimmed.toLowerCase().startsWith(prefix.toLowerCase()),
    );

    if (hasKnownPrefix) {
        return true;
    }

    // For keys without known prefixes, check they contain alphanumeric and common special chars
    const validCharsRegex = /^[a-zA-Z0-9_\-:.]+$/;
    return validCharsRegex.test(trimmed);
}

/**
 * Encrypt an API key for storage in Convex
 *
 * Phase 0 implementation: Base64 encoding (NOT secure for production)
 * TODO: Implement AES-GCM encryption with server-side key from Convex env vars
 *
 * The plan is:
 * 1. Client fetches a one-time encryption nonce from server
 * 2. Client encrypts with AES-GCM using shared secret
 * 3. Server decrypts when needed for API calls
 *
 * For now, we use base64 to get the flow working.
 */
export function encryptApiKey(key: string): string {
    // Phase 0: Simple base64 encoding
    // This is NOT secure - just a placeholder for the encryption flow
    // TODO: Replace with proper AES-GCM encryption

    const trimmed = key.trim();

    // Add a simple marker so we know it's "encrypted"
    const markedKey = `v0:${trimmed}`;

    // Base64 encode
    if (typeof window !== "undefined" && window.btoa) {
        return window.btoa(markedKey);
    }

    // Node.js fallback (for tests)
    return Buffer.from(markedKey).toString("base64");
}

/**
 * Decrypt an API key (server-side use only in HTTP actions)
 *
 * Phase 0 implementation: Base64 decoding
 * This function is provided for reference but actual decryption
 * should happen in Convex HTTP actions, not on the client.
 */
export function decryptApiKey(encryptedKey: string): string {
    // Phase 0: Simple base64 decoding

    let decoded: string;
    if (typeof window !== "undefined" && window.atob) {
        decoded = window.atob(encryptedKey);
    } else {
        // Node.js fallback
        decoded = Buffer.from(encryptedKey, "base64").toString("utf-8");
    }

    // Remove the version marker
    if (decoded.startsWith("v0:")) {
        return decoded.slice(3);
    }

    // Unknown format - return as-is
    return decoded;
}

/**
 * Provider display names for UI
 */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google AI",
    openrouter: "OpenRouter",
    perplexity: "Perplexity",
    grok: "Grok (xAI)",
    ollama: "Ollama (Local)",
    lmstudio: "LM Studio (Local)",
};

/**
 * Get display name for a provider
 */
export function getProviderDisplayName(provider: string): string {
    return PROVIDER_DISPLAY_NAMES[provider] || provider;
}

/**
 * Provider key setup instructions
 */
export const PROVIDER_KEY_INSTRUCTIONS: Record<string, string> = {
    openai: "Get your API key from platform.openai.com/api-keys",
    anthropic: "Get your API key from console.anthropic.com/settings/keys",
    google: "Get your API key from aistudio.google.com/app/apikey",
    openrouter: "Get your API key from openrouter.ai/keys",
    perplexity: "Get your API key from perplexity.ai/settings/api",
    grok: "Get your API key from x.ai/api",
    ollama: "Ollama runs locally - no API key needed",
    lmstudio: "LM Studio runs locally - no API key needed",
};

/**
 * Check if a provider requires an API key
 * Local providers (Ollama, LM Studio) don't need keys
 */
export function providerRequiresKey(provider: string): boolean {
    return !["ollama", "lmstudio"].includes(provider);
}
