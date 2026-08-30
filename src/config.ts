import { homedir } from "node:os";
import { join } from "node:path";
import { INTERNAL_APP_ID } from "./appMetadata";

const DATABASE_FILENAME = "memos.db";

export function getDatabasePath(): string {
  const configuredPath = process.env.TERMINAL_AI_MEMO_DB_PATH?.trim();

  if (configuredPath) {
    return configuredPath;
  }

  const xdgDataHome = process.env.XDG_DATA_HOME?.trim();

  if (xdgDataHome) {
    return join(xdgDataHome, INTERNAL_APP_ID, DATABASE_FILENAME);
  }

  if (process.platform === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      INTERNAL_APP_ID,
      DATABASE_FILENAME,
    );
  }

  return join(
    homedir(),
    ".local",
    "share",
    INTERNAL_APP_ID,
    DATABASE_FILENAME,
  );
}
