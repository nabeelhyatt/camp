import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Audit logging helper for Camp multiplayer
 *
 * Captures all mutations for enterprise compliance (Q4).
 * Data is stored but not displayed until Phase Q4.
 */

export type AuditAction =
    // Workspace actions
    | "workspace.create"
    | "workspace.update"
    | "workspace.delete"
    | "workspace.member.add"
    | "workspace.member.remove"
    | "workspace.member.role_change"
    // Project actions
    | "project.create"
    | "project.update"
    | "project.delete"
    // Chat actions
    | "chat.create"
    | "chat.update"
    | "chat.delete"
    | "chat.fork"
    | "chat.publish_summary"
    // Message actions
    | "message.send"
    | "message.delete"
    // MCP actions
    | "mcp.create"
    | "mcp.update"
    | "mcp.delete"
    | "mcp.enable"
    | "mcp.disable";

export type EntityType =
    | "workspace"
    | "project"
    | "chat"
    | "message"
    | "messageSet"
    | "mcp"
    | "user"
    | "invitation";

interface AuditLogParams {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    action: AuditAction;
    entityType: EntityType;
    entityId: string;
    metadata?: Record<string, unknown>;
}

/**
 * Log an audit event
 *
 * Call this in every mutation that modifies data.
 * The audit log is stored but not displayed until Q4.
 *
 * @example
 * await logAudit(ctx, {
 *   workspaceId: project.workspaceId,
 *   userId: user._id,
 *   action: "project.create",
 *   entityType: "project",
 *   entityId: projectId,
 *   metadata: { name: args.name },
 * });
 */
export async function logAudit(
    ctx: MutationCtx,
    params: AuditLogParams,
): Promise<Id<"auditLogs">> {
    return ctx.db.insert("auditLogs", {
        workspaceId: params.workspaceId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata,
        timestamp: Date.now(),
    });
}

/**
 * Log a batch of audit events (for cascade operations)
 */
export async function logAuditBatch(
    ctx: MutationCtx,
    events: AuditLogParams[],
): Promise<Id<"auditLogs">[]> {
    const ids: Id<"auditLogs">[] = [];

    for (const event of events) {
        const id = await logAudit(ctx, event);
        ids.push(id);
    }

    return ids;
}
