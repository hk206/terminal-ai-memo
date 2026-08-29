import { homedir } from "node:os";
import { join } from "node:path";

const APP_DIRECTORY = "terminal-ai-memo";
const DATABASE_FILENAME = "memos.db";

export function getDatabasePath(): string {
  const configuredPath = process.env.TERMINAL_AI_MEMO_DB_PATH?.trim();

  if (configuredPath) {
    return configuredPath;
  }

  const xdgDataHome = process.env.XDG_DATA_HOME?.trim();

  if (xdgDataHome) {
    return join(xdgDataHome, APP_DIRECTORY, DATABASE_FILENAME);
  }

  if (process.platform === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      APP_DIRECTORY,
      DATABASE_FILENAME,
    );
  }

  return join(
    homedir(),
    ".local",
    "share",
    APP_DIRECTORY,
    DATABASE_FILENAME,
  );
}
