// Environment detection
import { campConfig } from "@core/campConfig";

const DB_URL = "sqlite:chats.db";

export const config = {
    tellPostHogIAmATestUser: campConfig.isDev,
    dbUrl: DB_URL,
    // Use campConfig.proxyUrl for backend URL
    // This is kept for backwards compatibility with existing code
    meltyProxyUrl: campConfig.proxyUrl,
} as const;
