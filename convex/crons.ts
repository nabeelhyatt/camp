import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled Jobs for Camp multiplayer
 *
 * Convex cron jobs run automatically based on the schedule defined here.
 * They call internal mutations in maintenance.ts to clean up stale data.
 *
 * View scheduled jobs in the Convex dashboard: Functions > Scheduled
 *
 * Jobs:
 * - Stale presence cleanup (every 5 min)
 * - Stuck streaming cleanup (every 10 min)
 * - Empty message sets cleanup (every hour)
 * - Empty chats cleanup (daily at 3am UTC)
 */

const crons = cronJobs();

// ============================================================
// Frequent Cleanup (every few minutes)
// ============================================================

/**
 * Clean up stale presence records
 * Runs every 5 minutes
 *
 * Marks users as "offline" if their heartbeat hasn't been updated in 5 minutes.
 * This keeps the presence data accurate for real-time collaboration features.
 */
crons.interval(
    "cleanup stale presence",
    { minutes: 5 },
    internal.maintenance.cleanupStalePresence,
);

/**
 * Clean up stuck streaming messages
 * Runs every 10 minutes
 *
 * Marks messages stuck in "streaming" status as errors if they haven't been
 * updated in 10 minutes. This happens when users close their browser mid-stream.
 */
crons.interval(
    "cleanup stuck streaming",
    { minutes: 10 },
    internal.maintenance.cleanupStuckStreaming,
);

// ============================================================
// Less Frequent Cleanup (hourly/daily)
// ============================================================

/**
 * Clean up empty message sets
 * Runs every hour
 *
 * Removes message sets that were created but never had any messages added.
 * Uses hard delete since these are truly orphaned records.
 */
crons.interval(
    "cleanup empty message sets",
    { hours: 1 },
    internal.maintenance.cleanupEmptyMessageSets,
);

/**
 * Clean up empty chats
 * Runs daily at 3am UTC
 *
 * Soft-deletes chats that have been around for 24+ hours but never had
 * any message sets created. Runs during low-traffic hours.
 */
crons.cron(
    "cleanup empty chats",
    "0 3 * * *", // 3:00 AM UTC daily
    internal.maintenance.cleanupEmptyChats,
);

// ============================================================
// Optional: Monthly cleanup (disabled by default)
// ============================================================

// Uncomment to enable monthly cleanup of orphaned storage files
// This permanently deletes storage files for attachments that have been
// soft-deleted for 30+ days. Use with caution.
//
// crons.cron(
//     "cleanup orphaned storage",
//     "0 4 1 * *", // 4:00 AM UTC on the 1st of each month
//     internal.maintenance.cleanupOrphanedStorage,
// );

export default crons;
