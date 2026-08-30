import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { TeletypeMemoCore } from "../src/core/teletypeMemoCore";
import { openTeletypeMemoCore } from "../src/openTeletypeMemoCore";

describe("TeletypeMemoCore", () => {
  let core: TeletypeMemoCore;

  beforeEach(() => {
    core = openTeletypeMemoCore({
      databasePath: ":memory:",
      now: () => new Date("2026-08-30T12:34:56.000Z"),
    });
  });

  afterEach(() => {
    core.close();
  });

  test("captures an append-only raw memo and reads it by ID", () => {
    const captured = core.captureMemo("first line\nsecond line");

    expect(captured).toMatchObject({
      id: 1,
      body: "first line\nsecond line",
      createdAt: "2026-08-30T12:34:56.000Z",
      status: "raw",
    });
    expect(core.getMemo(captured.id)).toEqual(captured);
  });

  test("lists and searches memos through the frontend-neutral API", () => {
    const first = core.captureMemo("Gemini Function Calling");
    const second = core.captureMemo("shopping list");
    const third = core.captureMemo("Gemini structured output");

    expect(core.listMemos(2)).toEqual([third, second]);
    expect(core.searchMemos("Gemini")).toEqual([third, first]);
  });

  test("lists memos by an ISO date range", () => {
    const captured = core.captureMemo("today's memo");

    expect(
      core.listMemosByDate({
        createdFrom: "2026-08-30T00:00:00.000Z",
        createdTo: "2026-08-31T00:00:00.000Z",
      }),
    ).toEqual([captured]);
  });
});
