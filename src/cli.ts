#!/usr/bin/env bun

import { readMemoInput } from "./input";
import { MemoStore } from "./store";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
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
  console.error(`Failed to save memo: ${message}`);
  process.exitCode = 1;
}
