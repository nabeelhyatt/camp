import { internalMutation } from "./_generated/server";

/**
 * Maintenance operations for Camp multiplayer
 *
 * These are internal mutations called by scheduled cron jobs to clean up
 * stale or orphaned data. They run automatically in the background.
 *
 * Cleanup targets:
 * - Empty message sets (created but never had messages added)
 * - Stuck streaming messages (browser closed mid-stream)
 * - Empty chats (created but never used)
 * - Stale presence records (heartbeat timeout)
 */

// ============================================================
// Cleanup Functions
// ============================================================

/**
 * Clean up empty message sets
 *
 * Message sets are created when a user starts typing, but if they abandon
 * the message before sending, we're left with empty sets. This cleans them up.
 *
 * Condition: No messages after 1 hour
 * Action: Hard delete (no audit trail needed for empty records)
 */
export const cleanupEmptyMessageSets = internalMutation({
    handler: async (ctx) => {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        // Find message sets older than 1 hour that aren't deleted
        const oldSets = await ctx.db
            .query("messageSets")
            .filter((q) =>
                q.and(
                    q.lt(q.field("createdAt"), oneHourAgo),
                    q.eq(q.field("deletedAt"), undefined),
                ),
            )
            .collect();

        let deletedCount = 0;
        for (const set of oldSets) {
            // Check if it has any messages
            const firstMessage = await ctx.db
                .query("messages")
                .withIndex("by_message_set", (q) =>
                    q.eq("messageSetId", set._id),
                )
                .first();

            if (!firstMessage) {
                // No messages - hard delete the empty set
                await ctx.db.delete(set._id);
                deletedCount++;
            }
        }

        console.log(
            `[maintenance] Cleaned up ${deletedCount} empty message sets`,
        );
        return { deletedCount };
    },
});

/**
 * Mark stuck streaming messages as errors
 *
 * When a user's browser closes mid-stream (network issue, tab closed, etc.),
 * messages can get stuck in "streaming" status forever. This marks them as errors.
 *
 * Condition: status="streaming" for >10 minutes
 * Action: Mark as error with timeout message
 */
export const cleanupStuckStreaming = internalMutation({
    handler: async (ctx) => {
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

        const stuckMessages = await ctx.db
            .query("messages")
            .withIndex("by_status", (q) => q.eq("status", "streaming"))
            .filter((q) => q.lt(q.field("updatedAt"), tenMinutesAgo))
            .collect();

        const now = Date.now();
        for (const msg of stuckMessages) {
            await ctx.db.patch(msg._id, {
                status: "error",
                errorMessage: "Streaming timed out - connection was lost",
                streamingSessionId: undefined,
                updatedAt: now,
            });
        }

        console.log(
            `[maintenance] Marked ${stuckMessages.length} stuck streaming messages as errors`,
        );
        return { count: stuckMessages.length };
    },
});

/**
 * Clean up empty chats
 *
 * Chats can be created when the user opens a new chat view, but if they
 * never send a message, we're left with empty chats. This soft-deletes them.
 *
 * Condition: No message sets after 24 hours
 * Action: Soft delete
 */
export const cleanupEmptyChats = internalMutation({
    handler: async (ctx) => {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

        // Find chats older than 24 hours that aren't deleted
        const oldChats = await ctx.db
            .query("chats")
            .filter((q) =>
                q.and(
                    q.lt(q.field("createdAt"), oneDayAgo),
                    q.eq(q.field("deletedAt"), undefined),
                ),
            )
            .collect();

        let deletedCount = 0;
        const now = Date.now();

        for (const chat of oldChats) {
            // Check if it has any message sets
            const firstMessageSet = await ctx.db
                .query("messageSets")
                .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
                .first();

            if (!firstMessageSet) {
                // No message sets - soft delete
                await ctx.db.patch(chat._id, {
                    deletedAt: now,
                });
                deletedCount++;
            }
        }

        console.log(`[maintenance] Soft-deleted ${deletedCount} empty chats`);
        return { deletedCount };
    },
});

/**
 * Mark stale presence records as offline
 *
 * Presence records track who is online and what they're viewing.
 * If a heartbeat hasn't been received in 5 minutes, mark the user as offline.
 *
 * Condition: lastHeartbeat >5 minutes ago and status != "offline"
 * Action: Set status to "offline" and clear isTyping
 */
export const cleanupStalePresence = internalMutation({
    handler: async (ctx) => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

        const stalePresence = await ctx.db
            .query("presence")
            .filter((q) =>
                q.and(
                    q.lt(q.field("lastHeartbeat"), fiveMinutesAgo),
                    q.neq(q.field("status"), "offline"),
                ),
            )
            .collect();

        for (const p of stalePresence) {
            await ctx.db.patch(p._id, {
                status: "offline",
                isTyping: false,
            });
        }

        console.log(
            `[maintenance] Marked ${stalePresence.length} presence records as offline`,
        );
        return { count: stalePresence.length };
    },
});

/**
 * Clean up orphaned storage files (optional - for future use)
 *
 * When attachments are soft-deleted, the underlying storage files remain.
 * This could clean them up, but be careful - only run for truly orphaned files.
 *
 * Currently not scheduled - can be run manually if needed.
 */
export const cleanupOrphanedStorage = internalMutation({
    handler: async (ctx) => {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

        // Find attachments that have been soft-deleted for over 30 days
        const oldDeletedAttachments = await ctx.db
            .query("attachments")
            .filter((q) =>
                q.and(
                    q.neq(q.field("deletedAt"), undefined),
                    q.lt(q.field("deletedAt"), thirtyDaysAgo),
                ),
            )
            .collect();

        let deletedCount = 0;
        for (const att of oldDeletedAttachments) {
            try {
                // Delete the storage file
                await ctx.storage.delete(att.storageId);
                // Hard delete the attachment record
                await ctx.db.delete(att._id);
                deletedCount++;
            } catch (error) {
                // Storage file may already be deleted
                console.warn(
                    `[maintenance] Failed to delete storage for attachment ${att._id}:`,
                    error,
                );
            }
        }

        console.log(
            `[maintenance] Cleaned up ${deletedCount} orphaned storage files`,
        );
        return { deletedCount };
    },
});
