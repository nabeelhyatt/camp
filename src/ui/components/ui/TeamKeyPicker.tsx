import { Button } from "@ui/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/ui/avatar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@ui/components/ui/tooltip";
import { Key, Check } from "lucide-react";
import { TeamApiKey } from "@core/camp/api/TeamApiKeysAPI";
import { cn } from "@ui/lib/utils";

interface TeamKeyPickerProps {
    teamKeys: TeamApiKey[];
    selectedKeyId?: string;
    onSelect: (key: TeamApiKey) => void;
    className?: string;
}

/**
 * Displays a list of team-shared API keys for a provider,
 * allowing the user to select which teammate's key to use.
 */
export function TeamKeyPicker({
    teamKeys,
    selectedKeyId,
    onSelect,
    className,
}: TeamKeyPickerProps) {
    if (teamKeys.length === 0) {
        return null;
    }

    return (
        <div className={cn("space-y-2", className)}>
            <h4 className="text-sm font-medium text-muted-foreground">
                Team Keys
            </h4>
            <div className="space-y-1">
                {teamKeys.map((key) => (
                    <TeamKeyRow
                        key={key._id}
                        apiKey={key}
                        isSelected={selectedKeyId === key._id}
                        onSelect={() => onSelect(key)}
                    />
                ))}
            </div>
        </div>
    );
}

interface TeamKeyRowProps {
    apiKey: TeamApiKey;
    isSelected: boolean;
    onSelect: () => void;
}

function TeamKeyRow({ apiKey, isSelected, onSelect }: TeamKeyRowProps) {
    const sharerName = apiKey.isSharer
        ? "you"
        : apiKey.sharerSnapshot?.displayName || "Unknown";

    return (
        <div
            className={cn(
                "flex items-center justify-between p-2 rounded-md border transition-colors",
                isSelected
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-muted/50",
            )}
        >
            <div className="flex items-center gap-2">
                {/* Sharer avatar */}
                {apiKey.sharerSnapshot && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Avatar className="h-5 w-5">
                                <AvatarImage
                                    src={apiKey.sharerSnapshot.avatarUrl}
                                    alt={apiKey.sharerSnapshot.displayName}
                                />
                                <AvatarFallback className="text-[8px]">
                                    {getInitials(
                                        apiKey.sharerSnapshot.displayName,
                                    )}
                                </AvatarFallback>
                            </Avatar>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            {apiKey.sharerSnapshot.displayName}
                        </TooltipContent>
                    </Tooltip>
                )}

                <div className="flex flex-col">
                    <span className="text-sm">{sharerName}&apos;s key</span>
                    <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                        <Key className="h-2.5 w-2.5" />
                        ****{apiKey.keyHint}
                    </span>
                </div>
            </div>

            {isSelected ? (
                <div className="flex items-center gap-1 text-primary text-sm">
                    <Check className="h-4 w-4" />
                    <span>Active</span>
                </div>
            ) : (
                <Button variant="outline" size="sm" onClick={onSelect}>
                    Use this
                </Button>
            )}
        </div>
    );
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}
