# Terminal AI Memo

Terminal AI Memo is a local-first CLI inbox for capturing thoughts without leaving the terminal and organizing them with AI later.

> This project is in early development. Memo capture and local SQLite storage are currently implemented; AI organization is not implemented yet.

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

Send a natural-language instruction to Gemini:

```bash
bun run memo ask "今日一日分のメモをまとめて"
```

Gemini can use the read-only `listMemos`, `searchMemos`, and `readMemo` Tools to investigate local memos before answering. Tool calls are shown in the terminal while the agent runs.

The Gemini API free tier may use submitted content to improve Google's products. Use synthetic or non-sensitive memos while developing with the free tier.

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

See [docs/PRD.md](docs/PRD.md) for the product requirements and roadmap.
