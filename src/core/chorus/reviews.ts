import { ProviderName } from "./Models";

export type ReviewUnvalidated = {
    decision?: string;
    explanation?: string;
    revision?: string;
};

export function parseReview(
    text: string,
    isComplete: boolean,
): ReviewUnvalidated {
    const decision = text.match(/<decision>([\s\S]*?)<\/decision>/)?.[1];
    const explanation = text.match(
        /<explanation>([\s\S]*?)<\/explanation>/,
    )?.[1];
    let revision = text.match(/<revision>([\s\S]*?)<\/revision>/)?.[1];

    if (!revision && text.match(/<revision>/) && isComplete) {
        console.warn(
            `No revision end tag found in ${text}. Assuming it goes till end of response.`,
        );
        revision = text.match(/<revision>([\s\S]*?)$/)?.[1];
    } else if (decision !== "AGREE" && !revision && isComplete) {
        console.warn(`Hopeless revision ${text}`);
    }

    return {
        decision,
        explanation,
        revision,
    };
}

export const REVIEWERS: {
    [key: string]: {
        longName: string;
        shortName?: string;
        provider: ProviderName;
    };
} = {
    // NEVER REMOVE FROM THIS LIST
    "google::gemini-2.0-flash-thinking-exp": {
        longName: "Google Gemini 2.0 Flash Thinking",
        shortName: "Gemini",
        provider: "google",
    },
    "google::gemini-2.5-pro-preview-03-25": {
        longName: "Google Gemini 2.5 Pro (03-25)",
        shortName: "Gemini",
        provider: "google",
    },
    "google::gemini-2.5-pro-latest": {
        longName: "Google Gemini 2.5 Pro",
        shortName: "Gemini",
        provider: "google",
    },
    "openai::o3-mini": {
        longName: "OpenAI o3-mini",
        shortName: "o3",
        provider: "openai",
    },
    "58147fb6-1cd0-4c58-b0f0-2760bc96ef79": {
        longName: "Anthropic Claude 3.7 Sonnet Thinking",
        shortName: "Claude",
        provider: "anthropic",
    },
    "perplexity::sonar-pro": {
        longName: "Perplexity Sonar Pro",
        shortName: "Perplexity",
        provider: "perplexity",
    },
    "openai::o4-mini": {
        longName: "OpenAI o4-mini",
        shortName: "o4",
        provider: "openai",
    },
};

export const ACTIVE_REVIEWERS_ORDER: (keyof typeof REVIEWERS)[] = [
    "google::gemini-2.5-pro-latest",
    "58147fb6-1cd0-4c58-b0f0-2760bc96ef79",
    "openai::o4-mini",
    "perplexity::sonar-pro",
];
