import { describe, expect, test } from "bun:test";
import { moveSelection } from "../src/select";

describe("moveSelection", () => {
  test("moves down to the next option", () => {
    expect(moveSelection(0, 1, 3)).toBe(1);
  });

  test("wraps from the last option to the first", () => {
    expect(moveSelection(2, 1, 3)).toBe(0);
  });

  test("wraps from the first option to the last", () => {
    expect(moveSelection(0, -1, 3)).toBe(2);
  });
});
