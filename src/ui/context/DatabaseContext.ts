import Database from "@tauri-apps/plugin-sql";
import { createContext } from "react";

export const DatabaseContext = createContext<
    | {
          db: Database;
      }
    | undefined
>(undefined);
