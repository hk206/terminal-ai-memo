import { describe, expect, test } from "bun:test";
import {
  DraftReviewSession,
  type DraftReviser,
} from "../src/core/draftReviewSession";
import type { NotionPageDraft } from "../src/notion/draft";

const initialDraft: NotionPageDraft = {
  title: "Learning log",
  body: "Initial body",
  sourceMemoIds: [1],
};

describe("DraftReviewSession", () => {
  test("approves the current draft and makes the session terminal", async () => {
    const session = new DraftReviewSession(initialDraft, unusedReviser());

    expect(session.snapshot()).toEqual({
      status: "reviewing",
      draft: initialDraft,
    });
    expect(session.approve()).toEqual({
      status: "approved",
      draft: initialDraft,
    });
    expect(() => session.cancel()).toThrow(
      "Cannot cancel draft review while status is approved",
    );
    await expect(session.revise("too late")).rejects.toThrow(
      "Cannot revise draft review while status is approved",
    );
  });

  test("cancels without exposing an approved draft", () => {
    const session = new DraftReviewSession(initialDraft, unusedReviser());

    expect(session.cancel()).toEqual({ status: "canceled" });
    expect(session.snapshot()).toEqual({ status: "canceled" });
    expect(() => session.approve()).toThrow(
      "Cannot approve draft review while status is canceled",
    );
  });

  test("moves through revising and returns with the revised draft", async () => {
    const revisedDraft: NotionPageDraft = {
      ...initialDraft,
      body: "Revised body",
    };
    let finishRevision: (draft: NotionPageDraft) => void = () => {};
    const reviser: DraftReviser = {
      reviseDraft(draft, instruction) {
        expect(draft).toEqual(initialDraft);
        expect(instruction).toBe("もっと短くして");
        return new Promise((resolve) => {
          finishRevision = resolve;
        });
      },
    };
    const session = new DraftReviewSession(initialDraft, reviser);

    const revision = session.revise("もっと短くして");

    expect(session.snapshot()).toEqual({
      status: "revising",
      draft: initialDraft,
    });
    expect(() => session.approve()).toThrow(
      "Cannot approve draft review while status is revising",
    );

    finishRevision(revisedDraft);

    await expect(revision).resolves.toEqual({
      status: "reviewing",
      draft: revisedDraft,
    });
  });

  test("restores the previous draft when revision fails", async () => {
    const reviser: DraftReviser = {
      async reviseDraft() {
        throw new Error("model unavailable");
      },
    };
    const session = new DraftReviewSession(initialDraft, reviser);

    await expect(session.revise("change it")).rejects.toThrow(
      "model unavailable",
    );
    expect(session.snapshot()).toEqual({
      status: "reviewing",
      draft: initialDraft,
    });
  });
});

function unusedReviser(): DraftReviser {
  return {
    async reviseDraft() {
      throw new Error("unused");
    },
  };
}
