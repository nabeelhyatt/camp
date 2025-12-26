// Import polyfills first
import "../polyfills";

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PostHogProvider } from "posthog-js/react";
import { campConfig } from "@core/campConfig";

const options = {
    api_host: "https://us.i.posthog.com",
};

// suggested by Chorus
window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
});

// Analytics disabled for Camp Phase 1
// TODO: Create Camp PostHog project and update campConfig.posthogKey
const analyticsEnabled = campConfig.posthogKey !== "";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        {analyticsEnabled ? (
            <PostHogProvider apiKey={campConfig.posthogKey} options={options}>
                <App />
            </PostHogProvider>
        ) : (
            <App />
        )}
    </React.StrictMode>,
);
