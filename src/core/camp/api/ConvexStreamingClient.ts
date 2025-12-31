/**
 * Convex Streaming Client
 *
 * Frontend client for the Convex HTTP streaming endpoint.
 * Handles:
 * - SSE connection to /stream endpoint
 * - Token-by-token chunk delivery
 * - Tool call handling (returns to caller for MCP execution)
 * - Error handling with automatic retry support
 *
 * Usage:
 * ```typescript
 * await streamFromConvex({
 *   clerkId: "user_xxx",
 *   messageId: "j97sdf...",
 *   chatId: "j97sdf...",
 *   model: "openrouter::meta-llama/llama-4-scout",
 *   conversation: [...],
 *   streamingSessionId: uuid(),
 *   onChunk: (chunk) => setContent(prev => prev + chunk),
 *   onToolCall: async (calls) => { /* execute MCPs * / },
 *   onComplete: () => setStatus("complete"),
 *   onError: (msg) => setError(msg),
 * });
 * ```
 */

import type { LLMMessage } from "@core/chorus/Models";
import type { UserTool, UserToolCall } from "@core/chorus/Toolsets";
import { getUserToolNamespacedName } from "@core/chorus/Toolsets";

// ============================================================
// Types
// ============================================================

export interface StreamFromConvexParams {
    /** User's Clerk ID for authentication */
    clerkId: string;
    /** Convex message ID to update */
    messageId: string;
    /** Chat ID for context lookup */
    chatId: string;
    /** Full model ID (e.g., "openrouter::meta-llama/llama-4-scout") */
    model: string;
    /** Full conversation history */
    conversation: LLMMessage[];
    /** Unique session ID to prevent race conditions */
    streamingSessionId: string;
    /** Optional system prompt */
    systemPrompt?: string;
    /** Optional tools for function calling */
    tools?: UserTool[];
    /** Callback for each chunk of content */
    onChunk: (chunk: string) => void;
    /** Callback when tool calls are received (execute and return results) */
    onToolCall?: (calls: UserToolCall[]) => Promise<void>;
    /** Callback when streaming is complete */
    onComplete: (hasToolCalls: boolean) => void;
    /** Callback for errors (can be async) */
    onError: (message: string) => void | Promise<void>;
    /** AbortController signal for cancellation */
    signal?: AbortSignal;
}

interface StreamEvent {
    type: "chunk" | "tool_call" | "complete" | "error";
    content?: string;
    calls?: UserToolCall[];
    hasToolCalls?: boolean;
    message?: string;
}

// ============================================================
// Configuration
// ============================================================

/**
 * Get the Convex HTTP endpoint URL from environment
 * The URL is derived from the Convex URL by replacing .convex.cloud with .convex.site
 */
function getConvexHttpUrl(): string {
    const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
    if (!convexUrl) {
        throw new Error("VITE_CONVEX_URL is not set");
    }
    // Convert from .convex.cloud to .convex.site
    return convexUrl.replace(".convex.cloud", ".convex.site");
}

// ============================================================
// Main Streaming Function
// ============================================================

/**
 * Stream AI response from Convex HTTP endpoint
 *
 * This function:
 * 1. Sends conversation to Convex HTTP action
 * 2. Receives SSE stream with token chunks
 * 3. Calls onChunk for each token (immediate local display)
 * 4. Handles tool calls if received
 * 5. Signals completion or error
 *
 * The HTTP action also writes to the database periodically,
 * so other users see updates via Convex reactive queries.
 */
export async function streamFromConvex(
    params: StreamFromConvexParams,
): Promise<void> {
    const {
        clerkId,
        messageId,
        chatId,
        model,
        conversation,
        streamingSessionId,
        systemPrompt,
        tools,
        onChunk,
        onToolCall,
        onComplete,
        onError,
        signal,
    } = params;

    const baseUrl = getConvexHttpUrl();
    const url = `${baseUrl}/stream`;

    // Convert tools to the format expected by the server
    const toolDefinitions = tools?.map((tool) => ({
        name: getUserToolNamespacedName(tool),
        description: tool.description || "",
        inputSchema: tool.inputSchema,
    }));

    const requestBody = {
        clerkId,
        messageId,
        chatId,
        model,
        conversation,
        streamingSessionId,
        systemPrompt,
        tools: toolDefinitions,
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorJson = JSON.parse(errorText) as { error?: string };
                errorMessage = errorJson.error || errorMessage;
            } catch {
                errorMessage = errorText || errorMessage;
            }
            void onError(errorMessage);
            return;
        }

        if (!response.body) {
            void onError("No response body received");
            return;
        }

        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE events (separated by double newlines)
            const events = buffer.split("\n\n");
            buffer = events.pop() || ""; // Keep incomplete event in buffer

            for (const eventStr of events) {
                if (!eventStr.trim()) continue;

                // Parse SSE format: "data: {...}"
                const lines = eventStr.split("\n");
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const jsonStr = line.slice(6);
                        try {
                            const event = JSON.parse(jsonStr) as StreamEvent;
                            handleStreamEvent(event, {
                                onChunk,
                                onToolCall,
                                onComplete,
                                onError,
                            });
                        } catch (parseError) {
                            console.warn(
                                "Failed to parse SSE event:",
                                jsonStr,
                                parseError,
                            );
                        }
                    }
                }
            }
        }

        // Handle any remaining buffer content
        if (buffer.trim()) {
            const lines = buffer.split("\n");
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const jsonStr = line.slice(6);
                    try {
                        const event = JSON.parse(jsonStr) as StreamEvent;
                        handleStreamEvent(event, {
                            onChunk,
                            onToolCall,
                            onComplete,
                            onError,
                        });
                    } catch {
                        // Ignore parse errors for incomplete final chunk
                    }
                }
            }
        }
    } catch (error) {
        if (signal?.aborted) {
            // User cancelled - not an error
            return;
        }

        const errorMessage =
            error instanceof Error ? error.message : "Unknown streaming error";
        void onError(errorMessage);
    }
}

/**
 * Handle a single SSE event
 */
function handleStreamEvent(
    event: StreamEvent,
    handlers: {
        onChunk: (chunk: string) => void;
        onToolCall?: (calls: UserToolCall[]) => Promise<void>;
        onComplete: (hasToolCalls: boolean) => void;
        onError: (message: string) => void | Promise<void>;
    },
): void {
    switch (event.type) {
        case "chunk":
            if (event.content) {
                handlers.onChunk(event.content);
            }
            break;

        case "tool_call":
            if (event.calls && handlers.onToolCall) {
                // Fire and forget - the caller handles async execution
                void handlers.onToolCall(event.calls);
            }
            break;

        case "complete":
            handlers.onComplete(event.hasToolCalls || false);
            break;

        case "error":
            void handlers.onError(event.message || "Unknown error");
            break;
    }
}

// ============================================================
// Helper: Create streaming session ID
// ============================================================

/**
 * Generate a unique streaming session ID
 * Used to prevent race conditions with parallel streams
 */
export function createStreamingSessionId(): string {
    // Use crypto.randomUUID if available (modern browsers), fallback to manual UUID
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older environments
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ============================================================
// Helper: Build conversation from Convex messages
// ============================================================

/**
 * Convert Convex messages to LLMMessage format for streaming
 * This is used when continuing a conversation from Convex data
 */
export function buildConversationFromConvexMessages(
    messages: Array<{
        role: "user" | "assistant";
        parts: Array<{
            type: string;
            content: string;
            toolName?: string;
            toolCallId?: string;
        }>;
    }>,
): LLMMessage[] {
    const conversation: LLMMessage[] = [];

    for (const msg of messages) {
        if (msg.role === "user") {
            // Combine all text parts into content
            const content = msg.parts
                .filter((p) => p.type === "text")
                .map((p) => p.content)
                .join("\n");

            conversation.push({
                role: "user",
                content,
                attachments: [], // Attachments would need separate handling
            });
        } else if (msg.role === "assistant") {
            // Extract text content and tool calls
            const textContent = msg.parts
                .filter((p) => p.type === "text")
                .map((p) => p.content)
                .join("\n");

            const toolCalls: UserToolCall[] = msg.parts
                .filter((p) => p.type === "tool_call")
                .map((p) => {
                    let args: Record<string, unknown> = {};
                    try {
                        args = JSON.parse(p.content) as Record<string, unknown>;
                    } catch {
                        // Ignore parse errors
                    }
                    return {
                        id: p.toolCallId || "",
                        namespacedToolName: p.toolName || "",
                        args,
                    };
                });

            conversation.push({
                role: "assistant",
                content: textContent,
                toolCalls,
            });

            // If there are tool results, add them too
            const toolResults = msg.parts.filter(
                (p) => p.type === "tool_result",
            );
            if (toolResults.length > 0) {
                conversation.push({
                    role: "tool_results",
                    toolResults: toolResults.map((p) => ({
                        id: p.toolCallId || "",
                        content: p.content,
                    })),
                });
            }
        }
    }

    return conversation;
}
