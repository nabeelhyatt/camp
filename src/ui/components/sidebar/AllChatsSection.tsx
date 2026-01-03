import { ListIcon, ChevronRightIcon } from "lucide-react";
import { SidebarMenuButton } from "@ui/components/ui/sidebar";
import { type Chat } from "@core/camp/api/UnifiedChatAPI";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * All Chats Section - Clickable link to the full All Chats page
 *
 * In the sidebar, this shows as a simple clickable item that
 * navigates to /all-chats for a full-page experience.
 */

interface AllChatsSectionProps {
    chats: Chat[];
}

export function AllChatsSection({ chats }: AllChatsSectionProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = location.pathname === "/all-chats";
    const totalCount = chats.filter(
        (chat) => !chat.isNewChat && !chat.quickChat,
    ).length;

    if (totalCount === 0) {
        return null;
    }

    return (
        <div className="mt-2">
            <SidebarMenuButton
                onClick={() => navigate("/all-chats")}
                isActive={isActive}
                className="w-full flex items-center justify-between group/all-chats"
            >
                <div className="flex items-center gap-2 text-muted-foreground group-hover/all-chats:text-foreground">
                    <ListIcon className="size-3.5" strokeWidth={1.5} />
                    <span className="text-sm">All Chats</span>
                    <span className="text-xs text-muted-foreground">
                        ({totalCount})
                    </span>
                </div>
                <ChevronRightIcon
                    className="size-3.5 text-muted-foreground opacity-0 group-hover/all-chats:opacity-100 transition-opacity"
                    strokeWidth={1.5}
                />
            </SidebarMenuButton>
        </div>
    );
}
