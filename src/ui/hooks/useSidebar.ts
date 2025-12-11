import { SidebarContext } from "@ui/context/SidebarContext";
import React from "react";

export function useSidebar() {
    const context = React.useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider.");
    }

    return context;
}
