import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { TeletypeMemoCore } from "../src/core/teletypeMemoCore";
import { openTeletypeMemoCore } from "../src/openTeletypeMemoCore";
import { createMemoTools } from "../src/tools/memoTools";

describe("memo tools", () => {
  let core: TeletypeMemoCore;

  beforeEach(() => {
    core = openTeletypeMemoCore({ databasePath: ":memory:" });
  });

  afterEach(() => {
    core.close();
  });

  test("listMemos returns summaries instead of full long bodies", async () => {
    core.captureMemo("a".repeat(250));
    const tool = findTool("listMemos");

    const result = JSON.parse(await tool.execute({ limit: 5 }));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].preview.endsWith("…")).toBeTrue();
    expect(result[0].body).toBeUndefined();
  });

  test("searchMemos finds topic matches", async () => {
    core.captureMemo("コンテキスト圧縮を試す");
    core.captureMemo("買い物メモ");
    const tool = findTool("searchMemos");

    const result = JSON.parse(await tool.execute({ query: "圧縮" }));

    expect(result).toHaveLength(1);
    expect(result[0].preview).toContain("コンテキスト圧縮");
  });

  test("readMemo returns the full original memo", async () => {
    const memo = core.captureMemo("first line\nsecond line");
    const tool = findTool("readMemo");

    const result = JSON.parse(await tool.execute({ id: memo.id }));

    expect(result.body).toBe("first line\nsecond line");
  });

  test("readMemo rejects an invalid ID", async () => {
    const tool = findTool("readMemo");

    await expect(tool.execute({ id: -1 })).rejects.toThrow(
      "id must be a positive integer",
    );
  });

  function findTool(name: string) {
    const tool = createMemoTools(core).find((candidate) => candidate.name === name);

    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    return tool;
  }
});
