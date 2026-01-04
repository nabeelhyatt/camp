import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getApiKeys } from "@core/chorus/api/AppMetadataAPI";

type SimpleLLMParams = {
    model: string;
    maxTokens: number;
};

// Map Anthropic model names to OpenRouter equivalents
const ANTHROPIC_TO_OPENROUTER_MODEL: Record<string, string> = {
    "claude-3-5-sonnet-latest": "anthropic/claude-3.5-sonnet",
    "claude-3-5-sonnet-20241022": "anthropic/claude-3.5-sonnet",
    "claude-3-opus-20240229": "anthropic/claude-3-opus",
    "claude-3-sonnet-20240229": "anthropic/claude-3-sonnet",
    "claude-3-haiku-20240307": "anthropic/claude-3-haiku",
};

/**
 * Makes a simple LLM call via OpenRouter.
 * Used as fallback when no Anthropic API key is available.
 */
async function simpleLLMViaOpenRouter(
    prompt: string,
    params: SimpleLLMParams,
    apiKey: string,
): Promise<string> {
    const client = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        defaultHeaders: {
            "HTTP-Referer": "https://getcamp.ai",
            "X-Title": "Camp",
        },
        dangerouslyAllowBrowser: true,
    });

    // Map the Anthropic model name to OpenRouter format
    const openRouterModel =
        ANTHROPIC_TO_OPENROUTER_MODEL[params.model] ||
        `anthropic/${params.model}`;

    const stream = await client.chat.completions.create({
        model: openRouterModel,
        max_tokens: params.maxTokens,
        stream: true,
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
    });

    let fullResponse = "";

    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
            fullResponse += content;
        }
    }

    return fullResponse;
}

/**
 * Makes a simple LLM call using the Anthropic SDK directly.
 * Falls back to OpenRouter if no Anthropic API key is available.
 * Used for generating chat titles.
 */
export async function simpleLLM(
    prompt: string,
    params: SimpleLLMParams,
): Promise<string> {
    // Use centralized API key management (includes default OpenRouter fallback)
    const apiKeys = await getApiKeys();

    // Try Anthropic first if available
    if (apiKeys.anthropic) {
        const client = new Anthropic({
            apiKey: apiKeys.anthropic,
            dangerouslyAllowBrowser: true,
        });

        const stream = client.messages.stream({
            model: params.model,
            max_tokens: params.maxTokens,
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
        });

        let fullResponse = "";

        stream.on("text", (text: string) => {
            fullResponse += text;
        });

        await stream.finalMessage();

        return fullResponse;
    }

    // Fall back to OpenRouter (getApiKeys already includes default from env)
    if (apiKeys.openrouter) {
        return simpleLLMViaOpenRouter(prompt, params, apiKeys.openrouter);
    }

    throw new Error(
        "Please add your Anthropic or OpenRouter API key in Settings.",
    );
}

/**
 * Makes a simple LLM call using Google's Gemini models via OpenAI-compatible API.
 * Used for generating chat titles and summaries.
 */
export async function simpleSummarizeLLM(
    prompt: string,
    params: SimpleLLMParams,
): Promise<string> {
    // Use centralized API key management
    const apiKeys = await getApiKeys();

    if (!apiKeys.google) {
        throw new Error("Please add your Google AI API key in Settings.");
    }

    // Use Google's OpenAI-compatible endpoint
    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKeys.google}`,
            },
            body: JSON.stringify({
                model: params.model,
                max_tokens: params.maxTokens,
                stream: true,
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            }),
        },
    );

    if (!response.ok) {
        throw new Error(`Google API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                try {
                    const dataStr = line.slice(6);
                    if (dataStr === "[DONE]") continue;

                    const data = JSON.parse(dataStr) as {
                        choices?: Array<{
                            delta?: { content?: string };
                        }>;
                    };

                    const content = data.choices?.[0]?.delta?.content;
                    if (content) {
                        fullResponse += content;
                    }
                } catch (e) {
                    console.warn("Error parsing chunk:", e);
                }
            }
        }
    }

    return fullResponse;
}
