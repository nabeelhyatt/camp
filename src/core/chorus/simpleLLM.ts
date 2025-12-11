import Anthropic from "@anthropic-ai/sdk";
import { SettingsManager } from "@core/utilities/Settings";

type SimpleLLMParams = {
    model: string;
    maxTokens: number;
};

/**
 * Makes a simple LLM call using the Anthropic SDK directly.
 * Used for generating chat titles.
 */
export async function simpleLLM(
    prompt: string,
    params: SimpleLLMParams,
): Promise<string> {
    const settingsManager = SettingsManager.getInstance();
    const settings = await settingsManager.get();
    const apiKey = settings.apiKeys?.anthropic;

    if (!apiKey) {
        throw new Error("Please add your Anthropic API key in Settings.");
    }

    const client = new Anthropic({
        apiKey,
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

/**
 * Makes a simple LLM call using Google's Gemini models via OpenAI-compatible API.
 * Used for generating chat titles and summaries.
 */
export async function simpleSummarizeLLM(
    prompt: string,
    params: SimpleLLMParams,
): Promise<string> {
    const settingsManager = SettingsManager.getInstance();
    const settings = await settingsManager.get();
    const apiKey = settings.apiKeys?.google;

    if (!apiKey) {
        throw new Error("Please add your Google AI API key in Settings.");
    }

    // Use Google's OpenAI-compatible endpoint
    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
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
