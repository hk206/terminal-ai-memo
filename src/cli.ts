#!/usr/bin/env bun

import { readMemoInput } from "./input";
import { MemoStore } from "./store";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args[0] === "list") {
    listMemos(parseListLimit(args.slice(1)));
    return;
  }

  if (args[0] === "show") {
    showMemo(parseMemoId(args.slice(1), "show"));
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

    if (memos.length === 0) {
      console.log("No memos found.");
      return;
    }

    for (const memo of memos) {
      console.log(`#${memo.id}  ${memo.createdAt}  [${memo.status}]`);
      console.log(`  ${createPreview(memo.body)}`);
    }
  } finally {
    store.close();
  }
}

function showMemo(id: number): void {
  const store = new MemoStore();

  try {
    const memo = store.findById(id);

    if (!memo) {
      throw new Error(`Memo #${id} not found`);
    }

    console.log(`#${memo.id}  ${memo.createdAt}  [${memo.status}]`);

    if (memo.title) {
      console.log(`Title: ${memo.title}`);
    }

    if (memo.project) {
      console.log(`Project: ${memo.project}`);
    }

    console.log();
    console.log(memo.body);
  } finally {
    store.close();
  }
}

function parseMemoId(args: string[], command: string): number {
  if (args.length !== 1) {
    throw new Error(`Usage: memo ${command} <id>`);
  }

  const id = Number(args[0]);

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
