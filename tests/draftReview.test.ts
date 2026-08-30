import { describe, expect, test } from "bun:test";
import { parseDraftReviewAction } from "../src/notion/draftReview";

describe("parseDraftReviewAction", () => {
  test("accepts create choices", () => {
    expect(parseDraftReviewAction("y")).toBe("create");
    expect(parseDraftReviewAction("YES")).toBe("create");
  });

  test("accepts revision choices", () => {
    expect(parseDraftReviewAction("r")).toBe("revise");
    expect(parseDraftReviewAction(" revise ")).toBe("revise");
  });

  test("defaults an empty response to cancel", () => {
    expect(parseDraftReviewAction("")).toBe("cancel");
    expect(parseDraftReviewAction("n")).toBe("cancel");
  });

  test("rejects an unknown choice", () => {
    expect(parseDraftReviewAction("maybe")).toBe("invalid");
  });
});
