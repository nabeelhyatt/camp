import { createContext } from "react";

export const AppMetadataContext = createContext<
    Record<string, string> | undefined
>(undefined);
