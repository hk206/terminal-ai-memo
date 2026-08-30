import { describe, expect, test } from "bun:test";
import type { ApprovedDraftReviewState } from "../src/core/draftReviewSession";
import { NotionPublisher } from "../src/core/notionPublisher";

const approvedReview: ApprovedDraftReviewState = {
  status: "approved",
  draft: {
    title: "Learning log",
    body: "## Today\nLearned about publishing ports.",
    sourceMemoIds: [1],
  },
};

describe("NotionPublisher", () => {
  test("publishes the approved draft through the destination port", async () => {
    const receivedDrafts: unknown[] = [];
    const publisher = new NotionPublisher({
      async createPage(draft) {
        receivedDrafts.push(draft);
        return { id: "page-id", url: "https://notion.so/page-id" };
      },
    });

    await expect(publisher.publish(approvedReview)).resolves.toEqual({
      id: "page-id",
      url: "https://notion.so/page-id",
    });
    expect(receivedDrafts).toEqual([approvedReview.draft]);
  });

  test("rejects a non-approved state at runtime", () => {
    const publisher = new NotionPublisher({
      async createPage() {
        throw new Error("must not be called");
      },
    });
    const invalidReview = {
      status: "reviewing",
      draft: approvedReview.draft,
    } as unknown as ApprovedDraftReviewState;

    expect(() => publisher.publish(invalidReview)).toThrow(
      "Only an approved draft can be published to Notion",
    );
  });
});
