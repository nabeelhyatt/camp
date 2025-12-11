// Helper function to get display name for a model
export function getModelDisplayName(modelConfigId: string): string {
    const modelNames: Record<string, string> = {
        user: "You",
        "openai::gpt-4o": "GPT-4o",
        "openai::gpt-4.1": "GPT-4.1",
        "anthropic::claude-sonnet-4-latest": "Claude Sonnet",
        "anthropic::claude-opus-4-latest": "Claude Opus",
        "google::gemini-2.5-pro-latest": "Gemini Pro",
        "google::gemini-2.5-flash-preview-04-17": "Gemini Flash",
        "openai::o3": "o3",
        "openai::o3-pro": "o3-pro",
    };
    return (
        modelNames[modelConfigId] ||
        modelConfigId.split("::")[1] ||
        modelConfigId
    );
}

// Helper function to get avatar initials and color
export function getModelAvatar(modelConfigId: string): {
    initials: string;
    bgColor: string;
    textColor: string;
} {
    if (modelConfigId === "user") {
        return {
            initials: "U",
            bgColor: "bg-blue-500",
            textColor: "text-white",
        };
    }

    // Specific model colors
    const modelColors: Record<
        string,
        { initials: string; bgColor: string; textColor: string }
    > = {
        // OpenAI models
        "openai::gpt-4o": {
            initials: "4o",
            bgColor: "bg-emerald-500",
            textColor: "text-white",
        },
        "openai::gpt-4.1": {
            initials: "41",
            bgColor: "bg-emerald-600",
            textColor: "text-white",
        },
        "openai::o3": {
            initials: "o3",
            bgColor: "bg-teal-500",
            textColor: "text-white",
        },
        "openai::o3-pro": {
            initials: "o3",
            bgColor: "bg-teal-700",
            textColor: "text-white",
        },

        // Anthropic models
        "anthropic::claude-sonnet-4-latest": {
            initials: "S",
            bgColor: "bg-orange-500",
            textColor: "text-white",
        },
        "anthropic::claude-opus-4-latest": {
            initials: "O",
            bgColor: "bg-purple-600",
            textColor: "text-white",
        },

        // Google models
        "google::gemini-2.5-pro-latest": {
            initials: "G",
            bgColor: "bg-blue-600",
            textColor: "text-white",
        },
        "google::gemini-2.5-flash-preview-04-17": {
            initials: "F",
            bgColor: "bg-sky-500",
            textColor: "text-white",
        },
    };

    if (modelColors[modelConfigId]) {
        return modelColors[modelConfigId];
    }

    // Fallback colors by provider
    if (modelConfigId.startsWith("openai::")) {
        return {
            initials: "O",
            bgColor: "bg-emerald-500",
            textColor: "text-white",
        };
    }
    if (modelConfigId.startsWith("google::")) {
        return {
            initials: "G",
            bgColor: "bg-blue-500",
            textColor: "text-white",
        };
    }
    if (modelConfigId.startsWith("anthropic::")) {
        return {
            initials: "C",
            bgColor: "bg-orange-500",
            textColor: "text-white",
        };
    }

    return { initials: "AI", bgColor: "bg-gray-500", textColor: "text-white" };
}
