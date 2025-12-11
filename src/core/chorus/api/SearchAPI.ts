import { useQuery } from "@tanstack/react-query";
import { db } from "../DB";

const searchQuery = (query: string) => ({
    queryKey: ["searchResults", query] as const,
    queryFn: async () => {
        const results = await db.select<SearchResult[]>(
            `
                SELECT DISTINCT
                    m.id,
                    m.chat_id,
                    CASE 
                        WHEN m.model = 'user' THEN COALESCE(m.text, '')
                        ELSE COALESCE(NULLIF(m.text, ''), mp.content, '')
                    END as text,
                    m.model,
                    m.created_at,
                    c.title,
                    ms.type,
                    CASE 
                        WHEN m.model = 'user' THEN 'You'
                        ELSE m.model
                    END as message_type,
                    c.project_id,
                    c.parent_chat_id,
                    c.reply_to_id
                FROM messages m
                INNER JOIN chats c ON m.chat_id = c.id  -- Use INNER JOIN to ensure chat exists
                LEFT JOIN message_sets ms ON m.message_set_id = ms.id
                LEFT JOIN message_parts mp ON m.id = mp.message_id AND m.chat_id = mp.chat_id
                WHERE (
                    -- Search in message text (for user messages)
                    m.text LIKE '%' || $1 || '%'
                    -- Search in message parts content (for AI messages)
                    OR mp.content LIKE '%' || $1 || '%'
                    -- Search in chat titles
                    OR (c.title LIKE '%' || $1 || '%' AND c.title IS NOT NULL AND c.title != 'Untitled Chat')
                )
                ORDER BY m.created_at DESC
                LIMIT 50
            `,
            [query],
        );

        // Deduplicate by chat_id, keeping the most recent message
        const chatMap = new Map<string, SearchResult>();
        for (const result of results) {
            if (!chatMap.has(result.chat_id)) {
                chatMap.set(result.chat_id, result);
            }
        }

        return Array.from(chatMap.values());
    },
});

export interface SearchResult {
    id: string;
    chat_id: string;
    text: string;
    model: string;
    created_at: string;
    title?: string;
    type?: string; // "user" or "ai" message
    message_type?: string; // The message type (e.g., "user", model name)
    project_id?: string; // The project ID this chat belongs to
    parent_chat_id?: string; // The parent chat ID if this is a reply
    reply_to_id?: string; // The ID to set as replyID query param
}

export function useSearchMessages(query: string) {
    return useQuery(searchQuery(query));
}
