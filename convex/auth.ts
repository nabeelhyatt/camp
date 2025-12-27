import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List of personal email domains that don't get team workspaces
const PERSONAL_EMAIL_DOMAINS = new Set([
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.uk",
    "hotmail.com",
    "outlook.com",
    "live.com",
    "msn.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "aol.com",
    "proton.me",
    "protonmail.com",
    "fastmail.com",
    "zoho.com",
    "mail.com",
    "gmx.com",
    "gmx.de",
    "yandex.com",
    "tutanota.com",
]);

/**
 * Check if an email domain is a personal email provider
 */
function isPersonalEmail(email: string): boolean {
    const domain = email.split("@")[1]?.toLowerCase();
    return domain ? PERSONAL_EMAIL_DOMAINS.has(domain) : true;
}

/**
 * Format a domain into a readable organization name
 * e.g., "sparkcapital.com" -> "Spark Capital"
 */
function formatDomainToOrgName(domain: string): string {
    // Remove TLD
    const name = domain.split(".")[0];
    // Split on common separators and capitalize
    return name
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * Get user by Clerk ID
 */
export const getUserByClerkId = query({
    args: { clerkId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .first();
    },
});

/**
 * Get current user with organization and workspace data
 */
export const getCurrentUser = query({
    args: { clerkId: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .first();

        if (!user) {
            return null;
        }

        const org = await ctx.db.get(user.orgId);
        const activeWorkspace = user.activeWorkspaceId
            ? await ctx.db.get(user.activeWorkspaceId)
            : null;

        // Get all workspaces user has access to
        const workspaceMemberships = await ctx.db
            .query("workspaceMembers")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

        const workspaces = await Promise.all(
            workspaceMemberships.map(async (membership) => {
                const workspace = await ctx.db.get(membership.workspaceId);
                return workspace
                    ? { ...workspace, role: membership.role }
                    : null;
            }),
        );

        return {
            user,
            organization: org,
            activeWorkspace,
            workspaces: workspaces.filter(Boolean),
        };
    },
});

/**
 * Create or update user on sign-in
 * This is called after Clerk authentication
 */
export const syncUser = mutation({
    args: {
        clerkId: v.string(),
        email: v.string(),
        displayName: v.string(),
        avatarUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        // Check if user already exists
        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .first();

        if (existingUser) {
            // Update last seen and any changed profile data
            await ctx.db.patch(existingUser._id, {
                email: args.email,
                displayName: args.displayName,
                avatarUrl: args.avatarUrl,
                lastSeenAt: now,
            });

            return { userId: existingUser._id, isNewUser: false };
        }

        // New user - need to set up org and workspaces
        const domain = args.email.split("@")[1].toLowerCase();
        const isPersonal = isPersonalEmail(args.email);

        // For personal emails, create a unique personal domain
        const orgDomain = isPersonal ? `personal-${args.clerkId}` : domain;

        // Check if organization exists for this domain
        let org = await ctx.db
            .query("organizations")
            .withIndex("by_domain", (q) => q.eq("domain", orgDomain))
            .first();

        let isOrgOwner = false;

        if (!org) {
            // Create new organization
            const orgName = isPersonal
                ? `${args.displayName}'s Workspace`
                : formatDomainToOrgName(domain);

            const orgId = await ctx.db.insert("organizations", {
                domain: orgDomain,
                name: orgName,
                createdAt: now,
                updatedAt: now,
            });

            org = await ctx.db.get(orgId);
            isOrgOwner = true;
        }

        if (!org) {
            throw new Error("Failed to create organization");
        }

        // Create the user
        const userId = await ctx.db.insert("users", {
            clerkId: args.clerkId,
            email: args.email,
            displayName: args.displayName,
            avatarUrl: args.avatarUrl,
            orgId: org._id,
            role: isOrgOwner ? "owner" : "member",
            onboardingCompleted: false,
            createdAt: now,
            lastSeenAt: now,
        });

        // If new org owner, update the org
        if (isOrgOwner) {
            await ctx.db.patch(org._id, { ownerId: userId });
        }

        // Create personal workspace (everyone gets one)
        const personalWorkspaceId = await ctx.db.insert("workspaces", {
            orgId: org._id,
            type: "personal",
            ownerId: userId,
            name: "Personal",
            createdAt: now,
            updatedAt: now,
        });

        // Add user to personal workspace
        await ctx.db.insert("workspaceMembers", {
            workspaceId: personalWorkspaceId,
            userId: userId,
            role: "owner",
            joinedAt: now,
        });

        // For work emails, also add to or create team workspace
        if (!isPersonal) {
            let teamWorkspace = await ctx.db
                .query("workspaces")
                .withIndex("by_org_and_type", (q) =>
                    q.eq("orgId", org!._id).eq("type", "team"),
                )
                .first();

            if (!teamWorkspace) {
                // Create team workspace
                const teamWorkspaceId = await ctx.db.insert("workspaces", {
                    orgId: org._id,
                    type: "team",
                    name: org.name,
                    createdAt: now,
                    updatedAt: now,
                });
                teamWorkspace = await ctx.db.get(teamWorkspaceId);
            }

            if (teamWorkspace) {
                // Add user to team workspace
                await ctx.db.insert("workspaceMembers", {
                    workspaceId: teamWorkspace._id,
                    userId: userId,
                    role: isOrgOwner ? "owner" : "member",
                    joinedAt: now,
                });

                // Set team workspace as default active workspace
                await ctx.db.patch(userId, {
                    activeWorkspaceId: teamWorkspace._id,
                });
            }
        } else {
            // For personal emails, set personal workspace as active
            await ctx.db.patch(userId, {
                activeWorkspaceId: personalWorkspaceId,
            });
        }

        return { userId, isNewUser: true };
    },
});

/**
 * Update user's active workspace
 */
export const setActiveWorkspace = mutation({
    args: {
        clerkId: v.string(),
        workspaceId: v.id("workspaces"),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        // Verify user has access to this workspace
        const membership = await ctx.db
            .query("workspaceMembers")
            .withIndex("by_workspace_and_user", (q) =>
                q.eq("workspaceId", args.workspaceId).eq("userId", user._id),
            )
            .first();

        if (!membership) {
            throw new Error("User does not have access to this workspace");
        }

        await ctx.db.patch(user._id, {
            activeWorkspaceId: args.workspaceId,
            lastSeenAt: Date.now(),
        });

        return { success: true };
    },
});

/**
 * Mark onboarding as completed
 */
export const completeOnboarding = mutation({
    args: { clerkId: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        await ctx.db.patch(user._id, {
            onboardingCompleted: true,
        });

        return { success: true };
    },
});
