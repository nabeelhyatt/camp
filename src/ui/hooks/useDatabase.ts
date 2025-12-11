import { DatabaseContext } from "@ui/context/DatabaseContext";
import { useContext } from "react";

export function useDatabase() {
    const context = useContext(DatabaseContext);
    if (!context) {
        throw new Error("useDatabase must be used within a DatabaseProvider");
    }
    return context;
}
