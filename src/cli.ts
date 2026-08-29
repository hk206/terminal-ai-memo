#!/usr/bin/env bun

import { createGeminiAssistant } from "./gemini";
import { readMemoInput } from "./input";
import { selectOption } from "./select";
import { MemoStore } from "./store";
import type { Memo } from "./store";
import { createMemoTools } from "./tools/memoTools";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args[0] === "list") {
    listMemos(parseListLimit(args.slice(1)));
    return;
  }

  if (args[0] === "show") {
    await showMemoCommand(args.slice(1));
    return;
  }

  if (args[0] === "search") {
    searchMemos(parseSearchQuery(args.slice(1)));
    return;
  }

  if (args[0] === "ask") {
    await askGemini(parseAskInstruction(args.slice(1)));
    return;
  }

  const body =
    args.length > 0 ? args.join(" ") : await readInteractiveMemoBody();

  if (body === null) {
    return;
  }

  if (body.trim().length === 0) {
    console.log("No memo entered.");
    return;
  }

  const store = new MemoStore();

  try {
    const memo = store.create(body);
    console.log(`Saved memo #${memo.id}`);
  } finally {
    store.close();
  }
}

function listMemos(limit: number): void {
  const store = new MemoStore();

  try {
    const memos = store.list(limit);
    printMemoSummaries(memos, "No memos found.");
  } finally {
    store.close();
  }
}

function searchMemos(query: string): void {
  const store = new MemoStore();

  try {
    const memos = store.search(query);
    printMemoSummaries(memos, `No memos found for "${query}".`);
  } finally {
    store.close();
  }
}

async function askGemini(instruction: string): Promise<void> {
  const store = new MemoStore();
  const assistant = createGeminiAssistant({
    onRetry: ({ status, nextAttempt, maxAttempts, delayMilliseconds }) => {
      const delaySeconds = (delayMilliseconds / 1_000).toFixed(1);
      console.error(
        `Gemini returned ${status}; retrying in ${delaySeconds}s ` +
          `(${nextAttempt}/${maxAttempts})...`,
      );
    },
  });

  try {
    const response = await assistant.ask(instruction, {
      tools: createMemoTools(store),
      onToolCall: ({ name, args }) => {
        console.error(`[tool] ${name}(${JSON.stringify(args)})`);
      },
    });
    console.log(response);
  } finally {
    store.close();
  }
}

function printMemoSummaries(memos: Memo[], emptyMessage: string): void {
  if (memos.length === 0) {
    console.log(emptyMessage);
    return;
  }

  for (const memo of memos) {
    console.log(`#${memo.id}  ${memo.createdAt}  [${memo.status}]`);
    console.log(`  ${createPreview(memo.body)}`);
  }
}

async function showMemoCommand(args: string[]): Promise<void> {
  if (args.length > 1) {
    throw new Error("Usage: memo show [id]");
  }

  const store = new MemoStore();

  try {
    if (args.length === 1) {
      const id = parseMemoId(args[0]!);
      const memo = store.findById(id);

      if (!memo) {
        throw new Error(`Memo #${id} not found`);
      }

      printMemo(memo);
      return;
    }

    const candidates = store.list(10);

    if (candidates.length === 0) {
      console.log("No memos found.");
      return;
    }

    const selectedMemo = await selectOption(
      candidates.map((memo) => ({
        label: `#${memo.id}  ${createPreview(memo.body)}`,
        value: memo,
      })),
    );

    if (!selectedMemo) {
      console.log("Canceled.");
      return;
    }

    printMemo(selectedMemo);
  } finally {
    store.close();
  }
}

function printMemo(memo: Memo): void {
  console.log(`#${memo.id}  ${memo.createdAt}  [${memo.status}]`);

  if (memo.title) {
    console.log(`Title: ${memo.title}`);
  }

  if (memo.project) {
    console.log(`Project: ${memo.project}`);
  }

  console.log();
  console.log(memo.body);
}

function parseMemoId(value: string): number {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error("Memo ID must be a positive integer");
  }

  return id;
}

function parseListLimit(args: string[]): number {
  if (args.length === 0) {
    return 20;
  }

  if (args.length !== 2 || args[0] !== "--limit") {
    throw new Error("Usage: memo list [--limit <number>]");
  }

  const limit = Number(args[1]);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("List limit must be an integer between 1 and 100");
  }

  return limit;
}

function parseSearchQuery(args: string[]): string {
  const query = args.join(" ").trim();

  if (query.length === 0) {
    throw new Error("Usage: memo search <query>");
  }

  return query;
}

function parseAskInstruction(args: string[]): string {
  const instruction = args.join(" ").trim();

  if (instruction.length === 0) {
    throw new Error('Usage: memo ask "<instruction>"');
  }

  return instruction;
}

function createPreview(body: string): string {
  const singleLineBody = body.replace(/\n/g, " / ");
  const maxLength = 80;

  if (singleLineBody.length <= maxLength) {
    return singleLineBody;
  }

  return `${singleLineBody.slice(0, maxLength - 1)}…`;
}

async function readInteractiveMemoBody(): Promise<string | null> {
  console.log("New memo — submit with an empty line, cancel with Ctrl-C\n");

  const result = await readMemoInput();

  if (result.kind === "canceled") {
    console.log("\nCanceled.");
    return null;
  }

  return result.body;
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}
