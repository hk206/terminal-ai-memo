# Terminal AI Memo

Terminal AI Memo is a local-first CLI inbox for capturing thoughts without leaving the terminal and organizing them with AI later.

> This project is in early development. Memo capture and local SQLite storage are currently implemented; AI organization is not implemented yet.

## Requirements

- [Bun](https://bun.sh/) 1.3 or later

## Setup

```bash
bun install
```

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
