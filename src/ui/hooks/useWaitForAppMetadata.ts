import { useContext } from "react";
import { AppMetadataContext } from "@ui/context/AppMetadataContext";

export function useWaitForAppMetadata() {
    const context = useContext(AppMetadataContext);
    if (!context) {
        throw new Error(
            "useWaitForAppMetadata must be used within a AppMetadataProvider",
        );
    }
    return context;
}
