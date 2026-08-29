import { describe, expect, test } from "bun:test";
import { Readable, Writable } from "node:stream";
import { readMemoInput } from "../src/input";

function discardOutput(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

describe("readMemoInput", () => {
  test("joins entered lines and submits on an empty line", async () => {
    const input = Readable.from(["first line\nsecond line\n\nignored line\n"]);

    const result = await readMemoInput(input, discardOutput());

    expect(result).toEqual({
      kind: "submitted",
      body: "first line\nsecond line",
    });
  });

  test("returns an empty body when the first line is empty", async () => {
    const input = Readable.from(["\n"]);

    const result = await readMemoInput(input, discardOutput());

    expect(result).toEqual({ kind: "submitted", body: "" });
  });

  test("submits collected lines when input reaches EOF", async () => {
    const input = Readable.from(["first line\nsecond line"]);

    const result = await readMemoInput(input, discardOutput());

    expect(result).toEqual({
      kind: "submitted",
      body: "first line\nsecond line",
    });
  });
});
