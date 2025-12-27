import { ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

export default function FeedbackButton({
    className,
    children,
}: {
    children?: ReactNode;
    className?: string;
}) {
    const handleFeedbackClick = () => {
        void openUrl("https://github.com/nabeelhyatt/camp/issues");
    };

    return (
        <button onClick={handleFeedbackClick} className={className}>
            {children}
        </button>
    );
}
