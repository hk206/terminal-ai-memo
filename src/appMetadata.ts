export const PRODUCT_NAME = "Teletype Memo";
export const INTERNAL_APP_ID = "terminal-ai-memo";
export const APP_VERSION = "0.1.0";

export function createHelpText(): string {
  return `${PRODUCT_NAME} ${APP_VERSION}
An append-only inbox for your thoughts.

Usage:
  memo                         Capture a multiline memo
  memo "text"                  Capture a one-line memo
  memo list [--limit N]        List recent memos
  memo show [id]               Select or show a memo
  memo search <query>          Search memo bodies
  memo ask <instruction>       Create and review a Notion page draft
  memo notion connect          Connect to Notion MCP

Options:
  -h, --help                   Show this help
  -v, --version                Show the version`;
}
