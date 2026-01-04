import { GenericQueryCtx, GenericDataModel } from "convex/server";
import { GenericId } from "convex/values";

/**
 * Batch Fetch Utilities
 *
 * Helpers to avoid N+1 query patterns by batching lookups.
 * Instead of fetching one record at a time in a loop, these utilities
 * fetch all unique IDs in parallel and return a lookup map.
 */

/**
 * Batch fetch documents by their IDs.
 * Returns a Map for O(1) lookups.
 *
 * @example
 * const creatorIds = chats.map(c => c.createdBy);
 * const creatorMap = await batchGetByIds(ctx, "users", creatorIds);
 * const withCreators = chats.map(chat => ({
 *     ...chat,
 *     creator: creatorMap.get(chat.createdBy)
 * }));
 */
export async function batchGetByIds<
    DataModel extends GenericDataModel,
    TableName extends keyof DataModel & string,
>(
    ctx: GenericQueryCtx<DataModel>,
    _tableName: TableName,
    ids: GenericId<TableName>[],
): Promise<Map<GenericId<TableName>, DataModel[TableName]["document"] | null>> {
    // Dedupe IDs to avoid redundant fetches
    const uniqueIds = [...new Set(ids.filter(Boolean))];

    // Fetch all in parallel
    const documents = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));

    // Build lookup map
    const map = new Map<
        GenericId<TableName>,
        DataModel[TableName]["document"] | null
    >();
    uniqueIds.forEach((id, index) => {
        map.set(id, documents[index] ?? null);
    });

    return map;
}

/**
 * Helper type for user snapshot (creator/author attribution)
 */
export interface UserSnapshot {
    id: GenericId<"users">;
    displayName: string;
    avatarUrl?: string;
}

/**
 * Create a user snapshot from a user document.
 * Returns undefined if user is null/deleted.
 */
export function createUserSnapshot<
    T extends {
        _id: GenericId<"users">;
        displayName: string;
        avatarUrl?: string;
        deletedAt?: number;
    } | null,
>(user: T): UserSnapshot | undefined {
    if (!user || user.deletedAt) {
        return undefined;
    }

    return {
        id: user._id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
    };
}
