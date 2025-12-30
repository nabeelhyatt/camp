import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import OpenAI from "openai";
import type { Id } from "./_generated/dataModel";

/**
 * HTTP Action for AI Response Streaming
 *
 * This action handles server-side AI streaming with:
 * 1. Instant token-by-token streaming to the initiating client via SSE
 * 2. Periodic writes to DB (~200ms) for real-time sync to other users
 * 3. Tool call support (returns to client for local MCP execution)
 *
 * The architecture follows Convex's recommended pattern:
 * https://stack.convex.dev/ai-chat-with-http-streaming
 */

// ============================================================
// Types
// ============================================================

interface LLMMessageUser {
    role: "user";
    content: string;
    // Note: Attachments are handled separately - they're already inlined in content
}

interface LLMMessageAssistant {
    role: "assistant";
    content: string;
    model?: string;
    toolCalls: ToolCall[];
}

interface LLMMessageToolResults {
    role: "tool_results";
    toolResults: ToolResult[];
}

type LLMMessage = LLMMessageUser | LLMMessageAssistant | LLMMessageToolResults;

interface ToolCall {
    id: string;
    namespacedToolName: string;
    args: Record<string, unknown>;
}

interface ToolResult {
    id: string;
    content: string;
}

interface StreamRequestBody {
    clerkId: string;
    messageId: string;
    chatId: string;
    model: string; // Full model ID like "openrouter::meta-llama/llama-4-scout"
    conversation: LLMMessage[];
    streamingSessionId: string;
    systemPrompt?: string;
    tools?: ToolDefinition[];
}

interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}

// Provider configuration
interface ProviderConfig {
    baseUrl: string;
    modelName: string;
    headers?: Record<string, string>;
    supportsTools: boolean;
}

// ============================================================
// Provider Resolution
// ============================================================

type ProviderName =
    | "openai"
    | "anthropic"
    | "google"
    | "openrouter"
    | "perplexity"
    | "grok";

function getProviderName(modelId: string): ProviderName {
    const provider = modelId.split("::")[0];
    return provider as ProviderName;
}

function getProviderConfig(
    modelId: string,
    apiKey: string,
): ProviderConfig & { apiKey: string } {
    const providerName = getProviderName(modelId);
    const modelName = modelId.split("::")[1] || modelId;

    switch (providerName) {
        case "openai":
            return {
                baseUrl: "https://api.openai.com/v1",
                modelName,
                apiKey,
                supportsTools: true,
            };
        case "anthropic":
            // Anthropic uses a different API, but we can use their OpenAI-compatible endpoint
            return {
                baseUrl: "https://api.anthropic.com/v1",
                modelName,
                apiKey,
                headers: {
                    "anthropic-version": "2023-06-01",
                },
                supportsTools: true,
            };
        case "openrouter":
            return {
                baseUrl: "https://openrouter.ai/api/v1",
                modelName,
                apiKey,
                headers: {
                    "HTTP-Referer": "https://getcamp.ai",
                    "X-Title": "Camp",
                },
                supportsTools: true,
            };
        case "google":
            return {
                baseUrl:
                    "https://generativelanguage.googleapis.com/v1beta/openai",
                modelName,
                apiKey,
                supportsTools: true,
            };
        case "perplexity":
            return {
                baseUrl: "https://api.perplexity.ai",
                modelName,
                apiKey,
                supportsTools: false, // Perplexity has limited tool support
            };
        case "grok":
            return {
                baseUrl: "https://api.x.ai/v1",
                modelName,
                apiKey,
                supportsTools: true,
            };
        default: {
            const _exhaustiveCheck: never = providerName;
            throw new Error(
                `Unsupported provider: ${_exhaustiveCheck as string}`,
            );
        }
    }
}

// ============================================================
// Message Conversion
// ============================================================

function convertToOpenAIMessages(
    conversation: LLMMessage[],
    systemPrompt?: string,
): OpenAI.ChatCompletionMessageParam[] {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    // Add system prompt if provided
    if (systemPrompt) {
        messages.push({
            role: "system",
            content: systemPrompt,
        });
    }

    for (const msg of conversation) {
        if (msg.role === "user") {
            messages.push({
                role: "user",
                content: msg.content || "...", // Ensure non-empty
            });
        } else if (msg.role === "assistant") {
            const toolCalls =
                msg.toolCalls && msg.toolCalls.length > 0
                    ? msg.toolCalls.map((tc) => ({
                          id: tc.id,
                          type: "function" as const,
                          function: {
                              name: tc.namespacedToolName,
                              arguments: JSON.stringify(tc.args),
                          },
                      }))
                    : undefined;

            messages.push({
                role: "assistant",
                content: msg.content || "...", // Ensure non-empty
                ...(toolCalls && { tool_calls: toolCalls }),
            });
        } else if (msg.role === "tool_results") {
            for (const result of msg.toolResults) {
                messages.push({
                    role: "tool",
                    tool_call_id: result.id,
                    content: result.content || "...",
                });
            }
        }
    }

    return messages;
}

function convertToolDefinitions(
    tools: ToolDefinition[],
): OpenAI.ChatCompletionTool[] {
    return tools.map((tool) => ({
        type: "function" as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
        },
    }));
}

// ============================================================
// SSE Helpers
// ============================================================

function createSSEMessage(data: object): string {
    return `data: ${JSON.stringify(data)}\n\n`;
}

// ============================================================
// API Key Decryption
// ============================================================

function decryptApiKey(encryptedKey: string): string {
    // Simple base64 decoding with version prefix removal
    // The client encrypts with: btoa(`v0:${key}`)
    try {
        const decoded = atob(encryptedKey);
        if (decoded.startsWith("v0:")) {
            return decoded.slice(3);
        }
        // Fallback: assume it's already plain text
        return decoded;
    } catch {
        // If decoding fails, assume it's plain text
        return encryptedKey;
    }
}

// ============================================================
// Default API Keys (from environment)
// ============================================================

function getDefaultApiKey(provider: ProviderName): string | undefined {
    // In Convex HTTP actions, we use process.env
    // These are set via `npx convex env set`
    switch (provider) {
        case "openrouter":
            return process.env.DEFAULT_OPENROUTER_KEY;
        case "openai":
            return process.env.DEFAULT_OPENAI_KEY;
        case "anthropic":
            return process.env.DEFAULT_ANTHROPIC_KEY;
        case "google":
            return process.env.DEFAULT_GOOGLE_KEY;
        case "perplexity":
            return process.env.DEFAULT_PERPLEXITY_KEY;
        case "grok":
            return process.env.DEFAULT_GROK_KEY;
        default:
            return undefined;
    }
}

// ============================================================
// Main Stream Handler
// ============================================================

export const stream = httpAction(async (ctx, request) => {
    // CORS headers
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Parse request body
    let body: StreamRequestBody;
    try {
        body = (await request.json()) as StreamRequestBody;
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const {
        clerkId,
        messageId,
        chatId,
        model,
        conversation,
        streamingSessionId,
        systemPrompt,
        tools,
    } = body;

    // Validate required fields
    if (
        !clerkId ||
        !messageId ||
        !chatId ||
        !model ||
        !conversation ||
        !streamingSessionId
    ) {
        return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }

    // Get user and verify access
    const user = await ctx.runQuery(internal.lib.permissions.getUserByClerkId, {
        clerkId,
    });

    if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Get the chat to find workspace
    const chat = await ctx.runQuery(internal.streaming_internal.getChat, {
        chatId: messageId.split("/")[0] as Id<"chats">, // Extract chat ID if needed
    });

    // Resolve API key for the provider
    const providerName = getProviderName(model);
    let apiKey: string | undefined;

    // Try to get team key from Convex
    if (chat?.workspaceId) {
        const teamKeyResult = await ctx.runQuery(
            internal.apiKeys.getKeyForProvider,
            {
                workspaceId: chat.workspaceId,
                provider: providerName,
            },
        );

        if (teamKeyResult?.encryptedKey) {
            apiKey = decryptApiKey(teamKeyResult.encryptedKey);
        }
    }

    // Fall back to default key
    if (!apiKey) {
        apiKey = getDefaultApiKey(providerName);
    }

    if (!apiKey) {
        return new Response(
            JSON.stringify({
                error: `No API key configured for ${providerName}. Add a key in Settings.`,
            }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }

    // Get provider configuration
    const providerConfig = getProviderConfig(model, apiKey);

    // Create OpenAI client with provider-specific config
    const client = new OpenAI({
        baseURL: providerConfig.baseUrl,
        apiKey: providerConfig.apiKey,
        defaultHeaders: providerConfig.headers,
    });

    // Convert messages
    const messages = convertToOpenAIMessages(conversation, systemPrompt);

    // Build request params
    const params: OpenAI.ChatCompletionCreateParamsStreaming = {
        model: providerConfig.modelName,
        messages,
        stream: true,
    };

    // Add tools if supported and provided
    if (tools && tools.length > 0 && providerConfig.supportsTools) {
        params.tools = convertToolDefinitions(tools);
        params.tool_choice = "auto";
    }

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    let accumulatedContent = "";
    let lastDbWrite = Date.now();
    const DB_WRITE_INTERVAL = 200; // Write to DB every 200ms
    const chunks: OpenAI.ChatCompletionChunk[] = [];

    // Create the stream
    const readableStream = new ReadableStream({
        async start(controller) {
            try {
                const stream = await client.chat.completions.create(params);

                for await (const chunk of stream) {
                    chunks.push(chunk);
                    const delta = chunk.choices[0]?.delta;

                    if (delta?.content) {
                        accumulatedContent += delta.content;

                        // Send chunk to client immediately
                        const sseMessage = createSSEMessage({
                            type: "chunk",
                            content: delta.content,
                        });
                        controller.enqueue(encoder.encode(sseMessage));

                        // Write to DB periodically
                        const now = Date.now();
                        if (now - lastDbWrite >= DB_WRITE_INTERVAL) {
                            await ctx.runMutation(
                                internal.streaming_internal
                                    .updateStreamingContent,
                                {
                                    messageId: messageId as Id<"messages">,
                                    content: accumulatedContent,
                                    streamingSessionId,
                                },
                            );
                            lastDbWrite = now;
                        }
                    }
                }

                // Extract tool calls from chunks
                const toolCalls = extractToolCalls(chunks);

                // Final write to DB with complete content
                if (accumulatedContent) {
                    await ctx.runMutation(
                        internal.streaming_internal.updateStreamingContent,
                        {
                            messageId: messageId as Id<"messages">,
                            content: accumulatedContent,
                            streamingSessionId,
                        },
                    );
                }

                // If there are tool calls, send them and DON'T mark complete
                if (toolCalls.length > 0) {
                    const sseMessage = createSSEMessage({
                        type: "tool_call",
                        calls: toolCalls,
                    });
                    controller.enqueue(encoder.encode(sseMessage));
                } else {
                    // Mark message as complete
                    await ctx.runMutation(
                        internal.streaming_internal.completeMessage,
                        {
                            messageId: messageId as Id<"messages">,
                        },
                    );
                }

                // Send completion event
                const completeMessage = createSSEMessage({
                    type: "complete",
                    hasToolCalls: toolCalls.length > 0,
                });
                controller.enqueue(encoder.encode(completeMessage));
                controller.close();
            } catch (error) {
                console.error("Streaming error:", error);

                // Send error to client
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : "Unknown streaming error";
                const sseMessage = createSSEMessage({
                    type: "error",
                    message: errorMessage,
                });
                controller.enqueue(encoder.encode(sseMessage));

                // Mark message as error in DB
                try {
                    await ctx.runMutation(
                        internal.streaming_internal.errorMessage,
                        {
                            messageId: messageId as Id<"messages">,
                            errorMessage,
                        },
                    );
                } catch (dbError) {
                    console.error("Failed to mark message as error:", dbError);
                }

                controller.close();
            }
        },
    });

    return new Response(readableStream, {
        status: 200,
        headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
});

// ============================================================
// Tool Call Extraction
// ============================================================

function extractToolCalls(chunks: OpenAI.ChatCompletionChunk[]): ToolCall[] {
    // Tool calls are accumulated across chunks
    const toolCallMap = new Map<
        number,
        { id: string; name: string; arguments: string }
    >();

    for (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
                const existing = toolCallMap.get(tc.index) || {
                    id: "",
                    name: "",
                    arguments: "",
                };

                if (tc.id) {
                    existing.id = tc.id;
                }
                if (tc.function?.name) {
                    existing.name = tc.function.name;
                }
                if (tc.function?.arguments) {
                    existing.arguments += tc.function.arguments;
                }

                toolCallMap.set(tc.index, existing);
            }
        }
    }

    // Convert to our format
    const result: ToolCall[] = [];
    for (const [, tc] of toolCallMap) {
        if (tc.id && tc.name) {
            try {
                const args = JSON.parse(tc.arguments || "{}") as Record<
                    string,
                    unknown
                >;
                result.push({
                    id: tc.id,
                    namespacedToolName: tc.name,
                    args,
                });
            } catch {
                // Skip malformed tool calls
                console.warn(
                    "Failed to parse tool call arguments:",
                    tc.arguments,
                );
            }
        }
    }

    return result;
}
