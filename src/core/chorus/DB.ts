import { config } from "@core/config";
import Database from "@tauri-apps/plugin-sql";

export const db = await Database.load(config.dbUrl);
