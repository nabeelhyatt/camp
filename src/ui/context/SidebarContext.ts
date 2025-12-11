import React from "react";

export type SidebarContexts = {
    state: "expanded" | "collapsed";
    open: boolean;
    setOpen: (open: boolean) => void;
    openMobile: boolean;
    setOpenMobile: (open: boolean) => void;
    isMobile: boolean;
    toggleSidebar: () => void;
};

export const SidebarContext = React.createContext<SidebarContexts | null>(null);
