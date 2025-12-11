import { ReactNode } from "react";
import Database from "@tauri-apps/plugin-sql";
import { DatabaseContext } from "@ui/context/DatabaseContext";

// ----------------------------------
// Database provider
// ----------------------------------

export function DatabaseProvider({
    db,
    children,
}: {
    db: Database;
    children: ReactNode;
}) {
    return (
        <DatabaseContext.Provider
            value={{
                db,
            }}
        >
            {children}
        </DatabaseContext.Provider>
    );
}
