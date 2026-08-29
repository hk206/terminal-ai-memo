import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { MemoStore } from "../src/store";

describe("MemoStore", () => {
  let store: MemoStore;

  beforeEach(() => {
    store = new MemoStore(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  test("saves and reads back a multiline memo", () => {
    const memo = store.create("first line\nsecond line");

    expect(memo.id).toBe(1);
    expect(memo.body).toBe("first line\nsecond line");
    expect(memo.status).toBe("raw");
    expect(memo.title).toBeNull();
    expect(store.findById(memo.id)).toEqual(memo);
  });

  test("rejects an empty memo", () => {
    expect(() => store.create("  \n  ")).toThrow(
      "Memo body must not be empty",
    );
  });

  test("lists newest memos first and respects the limit", () => {
    store.create("first memo");
    const second = store.create("second memo");
    const third = store.create("third memo");

    expect(store.list(2)).toEqual([third, second]);
  });

  test("rejects an invalid list limit", () => {
    expect(() => store.list(0)).toThrow(
      "List limit must be a positive integer",
    );
  });

  test("returns null when a memo does not exist", () => {
    expect(store.findById(999)).toBeNull();
  });
});
