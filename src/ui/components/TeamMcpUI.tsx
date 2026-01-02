/**
 * Team MCP UI Components for Camp Multiplayer
 *
 * Components for displaying and managing team-shared MCPs:
 * - TeamMcpRow: Display a team MCP with sharer avatar and setup badge
 * - SetupCredentialsForm: Inline form for setting up credentials for a team MCP
 * - ShareToggle: Toggle between Private/Team sharing
 */

import { useState, useEffect } from "react";
import { Button } from "@ui/components/ui/button";
import { Label } from "@ui/components/ui/label";
import { Textarea } from "@ui/components/ui/textarea";
import { Switch } from "@ui/components/ui/switch";
import { Badge } from "@ui/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/ui/avatar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@ui/components/ui/tooltip";
import { Pencil, Trash2, AlertCircle, Users, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@convex/_generated/dataModel";
import { TeamMcpConfig } from "@core/camp/api/TeamMcpAPI";
import { CodeBlock } from "./renderers/CodeBlock";
import { getEnvFromJSON } from "@core/chorus/Toolsets";

// ============================================================
// TeamMcpRow Component
// ============================================================

interface TeamMcpRowProps {
    mcp: TeamMcpConfig;
    onSetupCredentials: (mcp: TeamMcpConfig) => void;
    onUnshare?: (mcpId: Id<"mcpConfigs">) => void;
    onEdit?: (mcp: TeamMcpConfig) => void;
}

/**
 * Display a team MCP with sharer attribution and setup status
 */
export function TeamMcpRow({
    mcp,
    onSetupCredentials,
    onUnshare,
    onEdit,
}: TeamMcpRowProps) {
    // Build command display text
    const displayCommandText =
        `${mcp.config.command} ${mcp.config.args || ""}`.trim();
    const truncatedCommandText =
        displayCommandText.length > 75
            ? displayCommandText.slice(0, 75) + "..."
            : displayCommandText;

    return (
        <div className="flex flex-col justify-between items-start p-4 border rounded-lg shadow-sm bg-card">
            <div className="w-full flex justify-between items-center">
                <div className="font-semibold text-card-foreground flex items-center gap-2">
                    {/* Sharer avatar */}
                    {mcp.sharerSnapshot && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Avatar className="h-6 w-6">
                                    <AvatarImage
                                        src={mcp.sharerSnapshot.avatarUrl}
                                        alt={mcp.sharerSnapshot.displayName}
                                    />
                                    <AvatarFallback className="text-[10px]">
                                        {getInitials(
                                            mcp.sharerSnapshot.displayName,
                                        )}
                                    </AvatarFallback>
                                </Avatar>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                Shared by {mcp.sharerSnapshot.displayName}
                            </TooltipContent>
                        </Tooltip>
                    )}
                    {mcp.name}

                    {/* Setup required badge */}
                    {mcp.needsSetup && (
                        <Badge
                            variant="outline"
                            className="ml-2 text-amber-600 border-amber-600"
                        >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Setup required
                        </Badge>
                    )}

                    {/* Team badge */}
                    <Badge
                        variant="outline"
                        className="ml-1 text-muted-foreground"
                    >
                        <Users className="h-3 w-3 mr-1" />
                        Team
                    </Badge>
                </div>

                <div className="flex space-x-1">
                    {/* Setup button (if needs setup) */}
                    {mcp.needsSetup && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSetupCredentials(mcp)}
                            className="text-amber-600 hover:text-amber-700"
                        >
                            Setup
                        </Button>
                    )}

                    {/* Edit button (only for sharer) */}
                    {mcp.isSharer && onEdit && (
                        <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() => onEdit(mcp)}
                            title="Edit"
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                    )}

                    {/* Unshare button (only for sharer) */}
                    {mcp.isSharer && onUnshare && (
                        <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() => onUnshare(mcp._id)}
                            title="Remove from team"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="mt-2 w-full border border-border text-sm rounded-md">
                <CodeBlock
                    language="sh"
                    overrideRunCommand={true}
                    contentToCopy={displayCommandText}
                    content={truncatedCommandText}
                />
            </div>

            {/* Credential status info */}
            {!mcp.needsSetup && mcp.hasUserCredentials && (
                <div className="text-[10px] text-muted-foreground mt-2">
                    Using your credentials
                </div>
            )}
            {!mcp.needsSetup &&
                !mcp.hasUserCredentials &&
                mcp.includeCredentials && (
                    <div className="text-[10px] text-muted-foreground mt-2">
                        Using {mcp.sharerSnapshot?.displayName}&apos;s
                        credentials
                    </div>
                )}
        </div>
    );
}

// ============================================================
// ShareToggle Component
// ============================================================

interface ShareToggleProps {
    isShared: boolean;
    onChange: (shared: boolean) => void;
    disabled?: boolean;
}

/**
 * Toggle between Private (local only) and Team (shared) modes
 */
export function ShareToggle({
    isShared,
    onChange,
    disabled,
}: ShareToggleProps) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                {isShared ? (
                    <Users className="h-4 w-4 text-primary" />
                ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                )}
                <Label htmlFor="share-toggle" className="text-sm">
                    {isShared ? "Shared with team" : "Private (only you)"}
                </Label>
            </div>
            <Switch
                id="share-toggle"
                checked={isShared}
                onCheckedChange={onChange}
                disabled={disabled}
            />
        </div>
    );
}

// ============================================================
// SetupCredentialsDialog Component (Inline Form)
// ============================================================

interface SetupCredentialsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (env: string) => Promise<void>;
    mcp: TeamMcpConfig | null;
}

/**
 * Inline form for setting up credentials for a team MCP
 * Uses the same pattern as RemoteToolsetForm in Settings.tsx
 */
export function SetupCredentialsDialog({
    isOpen,
    onClose,
    onSave,
    mcp,
}: SetupCredentialsDialogProps) {
    const [envValue, setEnvValue] = useState("{}");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Reset form when closed or MCP changes
    useEffect(() => {
        if (!isOpen) {
            setEnvValue("{}");
            setError(null);
        }
    }, [isOpen]);

    const validateEnv = (value: string): string | null => {
        if (!value.trim()) return null;
        try {
            const parsed = getEnvFromJSON(value);
            if (parsed._type === "error") {
                return parsed.error;
            }
            return null;
        } catch {
            return "Invalid JSON format";
        }
    };

    const handleEnvChange = (value: string) => {
        setEnvValue(value);
        setError(validateEnv(value));
    };

    const handleSave = async () => {
        const validationError = validateEnv(envValue);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        try {
            await onSave(envValue);
            toast.success("Credentials saved");
            onClose();
            setEnvValue("{}");
        } catch (err) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Failed to save credentials",
            );
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen || !mcp) return null;

    return (
        <div className="space-y-4 border rounded-md p-4 max-w-full overflow-hidden mt-4 bg-muted/50">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold">
                    Setup credentials for &quot;{mcp.name}&quot;
                </h4>
                <Button
                    variant="ghost"
                    size="iconSm"
                    onClick={onClose}
                    title="Close"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <p className="text-sm text-muted-foreground">
                Enter the environment variables needed to run this MCP.
                {mcp.sharerSnapshot && (
                    <> Shared by {mcp.sharerSnapshot.displayName}.</>
                )}
            </p>

            <div className="space-y-2">
                <Label htmlFor="env-vars">Environment Variables (JSON)</Label>
                <Textarea
                    id="env-vars"
                    value={envValue}
                    onChange={(e) => handleEnvChange(e.target.value)}
                    placeholder='{"API_KEY": "your-api-key"}'
                    className="font-mono"
                    rows={4}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="text-sm text-muted-foreground">
                <p>
                    <strong>Command:</strong> {mcp.config.command}
                </p>
                <p>
                    <strong>Args:</strong> {mcp.config.args}
                </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    size="sm"
                    onClick={() => void handleSave()}
                    disabled={isLoading || !!error}
                >
                    {isLoading ? "Saving..." : "Save credentials"}
                </Button>
            </div>
        </div>
    );
}

// ============================================================
// Utilities
// ============================================================

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}
