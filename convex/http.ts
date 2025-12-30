import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { stream } from "./streaming";

/**
 * HTTP Router for Camp Multiplayer
 *
 * Provides HTTP endpoints that can't be handled by regular Convex queries/mutations:
 * - /stream: AI response streaming with server-sent events
 *
 * These endpoints are accessed at:
 * https://<your-convex-deployment>.convex.site/<path>
 */

const http = httpRouter();

/**
 * POST /stream - Stream AI responses
 *
 * Initiates a streaming connection to an AI model and:
 * 1. Streams tokens back to the initiating client via SSE
 * 2. Periodically writes content to the database (~200ms intervals)
 * 3. Other clients see updates via Convex's reactive queries
 *
 * Request body:
 * {
 *   clerkId: string,           // User's Clerk ID for auth
 *   messageId: string,         // Convex message ID to update
 *   chatId: string,            // Chat context
 *   model: string,             // Model ID (e.g., "gpt-4", "claude-3-opus")
 *   conversation: LLMMessage[], // Full conversation history
 *   streamingSessionId: string, // UUID to prevent race conditions
 * }
 *
 * Response: Server-Sent Events stream
 * - data: {"type": "chunk", "content": "..."} - Token chunk
 * - data: {"type": "tool_call", "calls": [...]} - Tool call request
 * - data: {"type": "complete"} - Stream complete
 * - data: {"type": "error", "message": "..."} - Error occurred
 */
http.route({
    path: "/stream",
    method: "POST",
    handler: stream,
});

/**
 * CORS preflight for /stream
 * Required for browser-based requests to the streaming endpoint
 */
http.route({
    path: "/stream",
    method: "OPTIONS",
    handler: httpAction(async () => {
        return Promise.resolve(
            new Response(null, {
                status: 204,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers":
                        "Content-Type, Authorization",
                    "Access-Control-Max-Age": "86400",
                },
            }),
        );
    }),
});

export default http;
