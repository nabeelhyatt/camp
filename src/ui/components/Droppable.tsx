import { useDroppable } from "@dnd-kit/core";

interface DroppableProps {
    id: string;
    children: React.ReactNode;
}

export default function Droppable({ id, children }: DroppableProps) {
    const { isOver, setNodeRef } = useDroppable({
        id,
    });

    const style = {
        transition: "background-color 0.2s ease",
    };

    return (
        <div
            ref={setNodeRef}
            className={`rounded-md ${isOver ? "bg-sidebar-accent" : ""}`}
            style={style}
        >
            {children}
        </div>
    );
}
