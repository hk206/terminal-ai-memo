import { describe, expect, test } from "bun:test";
import {
  formatNotionPageDraft,
  parseNotionPageDraft,
} from "../src/notion/draft";

describe("Notion page draft", () => {
  test("parses and normalizes a structured draft", () => {
    expect(
      parseNotionPageDraft(
        JSON.stringify({
          title: "  Learning log  ",
          body: "  ## Today\nLearned about MCP.  ",
          sourceMemoIds: [3, 1, 3],
        }),
      ),
    ).toEqual({
      title: "Learning log",
      body: "## Today\nLearned about MCP.",
      sourceMemoIds: [3, 1],
    });
  });

  test("rejects malformed JSON", () => {
    expect(() => parseNotionPageDraft("not-json")).toThrow(
      "Gemini returned invalid JSON",
    );
  });

  test("rejects invalid source IDs", () => {
    expect(() =>
      parseNotionPageDraft(
        JSON.stringify({ title: "Title", body: "Body", sourceMemoIds: [0] }),
      ),
    ).toThrow("invalid source memo IDs");
  });

  test("formats a terminal preview", () => {
    const output = formatNotionPageDraft({
      title: "Learning log",
      body: "## Today\nLearned about MCP.",
      sourceMemoIds: [1, 3],
    });

    expect(output).toContain("Title: Learning log");
    expect(output).toContain("## Today\nLearned about MCP.");
    expect(output).toContain("Sources: #1, #3");
  });
});
