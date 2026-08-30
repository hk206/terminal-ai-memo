# Teletype Memo

Teletype Memo is a local-first, append-only inbox for capturing thoughts without leaving your work and organizing them with AI later.

Raw memos are append-only: corrections are captured as new memos, while AI-generated Markdown and Notion pages are treated as derived documents. Local memo operations, AI draft generation, review state transitions, and approval-gated Notion publishing run through frontend-neutral core APIs; the current CLI is their first frontend, and a future desktop frontend can invoke the same core from a global shortcut.

> This project is in early development. Local memo capture, Gemini-powered investigation, approval-gated revision, and Notion MCP page creation are implemented. Destination configuration and production hardening are still in progress.

## Requirements

- [Bun](https://bun.sh/) 1.3 or later

## Setup

```bash
bun install
cp .env.example .env
```

Add a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) to `.env` when using `memo ask`. The local capture, list, show, and search commands do not require an API key.

## Usage

Start multiline input:

```bash
bun run memo
```

Enter an empty line to save the memo, or press `Ctrl-C` to cancel.

Save a one-line memo:

```bash
bun run memo "Remember to inspect context compression"
```

List, open, or search saved memos:

```bash
bun run memo list
bun run memo show
bun run memo show 1
bun run memo search "context compression"
```

Show CLI help or the current version:

```bash
bun run memo --help
bun run memo --version
```

Ask Gemini to investigate local memos and prepare a Notion page:

```bash
bun run memo ask "今日一日分のメモをまとめて"
```

Gemini can use the read-only `listMemos`, `searchMemos`, and `readMemo` Tools to investigate local memos before answering. Tool calls are shown in the terminal while the agent runs.

The CLI previews the generated title, Markdown body, and source memo IDs before writing anything to Notion:

```text
[y] Create in Notion  [r] Revise  [n] Cancel
>
```

Choose `r` to enter a revision instruction and preview the updated draft again. Choose `n` or press Enter to exit without writing to Notion. Only `y` connects to Notion MCP and creates a private page.

The Gemini API free tier may use submitted content to improve Google's products. Use synthetic or non-sensitive memos while developing with the free tier.

Connect to Notion's hosted MCP server:

```bash
bun run memo notion connect
```

The command opens Notion's OAuth page in the browser. OAuth credentials are stored in macOS Keychain; they are not written to `.env`, SQLite, or the repository. After authorization, the CLI displays the connected workspace and the MCP Tools available to it.

On macOS, memos are stored by default at:

```text
~/Library/Application Support/terminal-ai-memo/memos.db
```

Set `TERMINAL_AI_MEMO_DB_PATH` to use a different database path.

## Development

```bash
bun test
bun run typecheck
```

See [docs/PRD.md](docs/PRD.md) for the product requirements and roadmap, and [docs/DETAILED_DESIGN.md](docs/DETAILED_DESIGN.md) for a file-by-file explanation of the current implementation.
