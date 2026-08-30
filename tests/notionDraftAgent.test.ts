import { describe, expect, test } from "bun:test";
import {
  NotionDraftAgent,
  type DraftModel,
  type DraftToolCall,
} from "../src/core/notionDraftAgent";
import type { NotionPageDraft } from "../src/notion/draft";
import type { AgentTool } from "../src/tools/types";

const initialDraft: NotionPageDraft = {
  title: "Learning log",
  body: "## Today\nLearned about agent tools.",
  sourceMemoIds: [1],
};

describe("NotionDraftAgent", () => {
  test("starts a review with memo tools and forwards tool events", async () => {
    const memoTool = createFakeMemoTool();
    const toolEvents: DraftToolCall[] = [];
    const model: DraftModel = {
      async createNotionDraft(instruction, options) {
        expect(instruction).toBe("今日のメモをまとめて");
        expect(options.tools).toEqual([memoTool]);
        options.onToolCall?.({ name: "readMemo", args: { id: 1 } });
        return initialDraft;
      },
      async reviseNotionDraft() {
        throw new Error("unused");
      },
    };
    const agent = new NotionDraftAgent(model, [memoTool]);

    const review = await agent.startReview("今日のメモをまとめて", {
      onToolCall: (details) => toolEvents.push(details),
    });

    expect(review.snapshot()).toEqual({
      status: "reviewing",
      draft: initialDraft,
    });
    expect(toolEvents).toEqual([{ name: "readMemo", args: { id: 1 } }]);
  });

  test("revises the current draft through the model port", async () => {
    const revisedDraft: NotionPageDraft = {
      ...initialDraft,
      body: "## Today\n- [x] Learned about agent tools.",
    };
    const model: DraftModel = {
      async createNotionDraft() {
        throw new Error("unused");
      },
      async reviseNotionDraft(draft, revisionInstruction) {
        expect(draft).toEqual(initialDraft);
        expect(revisionInstruction).toBe("チェックリストにして");
        return revisedDraft;
      },
    };
    const agent = new NotionDraftAgent(model, []);

    await expect(
      agent.reviseDraft(initialDraft, "チェックリストにして"),
    ).resolves.toEqual(revisedDraft);
  });
});

function createFakeMemoTool(): AgentTool {
  return {
    name: "readMemo",
    description: "Read a memo",
    parameters: { type: "object" },
    async execute() {
      return JSON.stringify({ id: 1, body: "test" });
    },
  };
}
