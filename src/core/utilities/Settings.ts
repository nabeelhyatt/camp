import { getStore } from "@core/infra/Store";
import { emit } from "@tauri-apps/api/event";

// Default API keys from environment variables (set at build time)
const DEFAULT_OPENROUTER_KEY =
    (import.meta.env.VITE_DEFAULT_OPENROUTER_KEY as string) || "";
const DEFAULT_FIRECRAWL_KEY =
    (import.meta.env.VITE_DEFAULT_FIRECRAWL_KEY as string) || "";

export interface Settings {
    defaultEditor: string;
    sansFont: string;
    monoFont: string;
    autoConvertLongText: boolean;
    autoScrapeUrls: boolean;
    apiKeys?: {
        anthropic?: string;
        openai?: string;
        google?: string;
        perplexity?: string;
        openrouter?: string;
        firecrawl?: string;
    };
    quickChat?: {
        enabled?: boolean;
        modelConfigId?: string;
        shortcut?: string;
    };
    lmStudioBaseUrl?: string;
    cautiousEnter?: boolean;
}

export class SettingsManager {
    private static instance: SettingsManager;
    private storeName = "settings";

    private constructor() {}

    public static getInstance(): SettingsManager {
        if (!SettingsManager.instance) {
            SettingsManager.instance = new SettingsManager();
        }
        return SettingsManager.instance;
    }

    public async get(): Promise<Settings> {
        try {
            const store = await getStore(this.storeName);
            const settings = await store.get("settings");
            // Build default API keys from environment variables
            const defaultApiKeys: Settings["apiKeys"] = {};
            if (DEFAULT_OPENROUTER_KEY) {
                defaultApiKeys.openrouter = DEFAULT_OPENROUTER_KEY;
            }
            if (DEFAULT_FIRECRAWL_KEY) {
                defaultApiKeys.firecrawl = DEFAULT_FIRECRAWL_KEY;
            }

            const defaultSettings = {
                defaultEditor: "default",
                sansFont: "Geist",
                monoFont: "Geist Mono",
                autoConvertLongText: true,
                autoScrapeUrls: true,
                apiKeys: defaultApiKeys,
                quickChat: {
                    enabled: true,
                    modelConfigId: "anthropic::claude-3-5-sonnet-latest",
                    shortcut: "Alt+Space",
                },
            };

            // If no settings exist yet, save the defaults
            if (!settings) {
                await this.set(defaultSettings);
                return defaultSettings;
            }

            return (settings as Settings) || defaultSettings;
        } catch (error) {
            console.error("Failed to get settings:", error);
            const fallbackApiKeys: Settings["apiKeys"] = {};
            if (DEFAULT_OPENROUTER_KEY) {
                fallbackApiKeys.openrouter = DEFAULT_OPENROUTER_KEY;
            }
            if (DEFAULT_FIRECRAWL_KEY) {
                fallbackApiKeys.firecrawl = DEFAULT_FIRECRAWL_KEY;
            }
            return {
                defaultEditor: "default",
                sansFont: "Geist",
                monoFont: "Fira Code",
                autoConvertLongText: true,
                autoScrapeUrls: true,
                apiKeys: fallbackApiKeys,
                quickChat: {
                    enabled: true,
                    modelConfigId: "anthropic::claude-3-5-sonnet-latest",
                    shortcut: "Alt+Space",
                },
            };
        }
    }

    public async set(settings: Settings): Promise<void> {
        try {
            const store = await getStore(this.storeName);
            await store.set("settings", settings);
            await store.save();
            await emit("settings-changed", settings);
        } catch (error) {
            console.error("Failed to save settings:", error);
        }
    }

    public async getChorusToken(): Promise<string | null> {
        try {
            const store = await getStore("auth.dat");
            const token = await store.get("api_token");
            return (token as string) || null;
        } catch (error) {
            console.error("Failed to get Chorus token:", error);
            return null;
        }
    }
}
