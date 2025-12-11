interface OllamaResponse {
    model: string;
    created_at: string;
    message: {
        role: "assistant";
        content: string;
        images?: string[] | null;
    };
    done: boolean;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    eval_count?: number;
    eval_duration?: number;
}

interface OllamaMessage {
    role: "user" | "assistant";
    content: string;
    images?: string[];
}

export class OllamaClient {
    private baseUrl: string;

    constructor(baseUrl: string = "http://localhost:11434") {
        this.baseUrl = baseUrl;
    }

    async *streamChat(
        model: string,
        messages: OllamaMessage[],
        options: {
            format?: string;
        } = {},
    ): AsyncGenerator<string, void, unknown> {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                messages,
                format: options.format,
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("No reader available");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line) as OllamaResponse;
                        if (data.message?.content) {
                            yield data.message.content;
                        }
                    } catch (e) {
                        console.error("Error parsing Ollama response:", e);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    async listModels() {
        const response = await fetch(`${this.baseUrl}/api/tags`);
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }
        return response.json() as Promise<{ models: { name: string }[] }>;
    }

    async isHealthy() {
        try {
            const response = await fetch(`${this.baseUrl}`);
            return response.ok;
        } catch {
            return false;
        }
    }
}

// Create a singleton instance
export const ollamaClient = new OllamaClient();
