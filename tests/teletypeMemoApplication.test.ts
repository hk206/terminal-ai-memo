import { describe, expect, test } from "bun:test";
import { DraftReviewSession } from "../src/core/draftReviewSession";
import type { Memo, MemoRepository } from "../src/core/memo";
import {
  TeletypeMemoApplication,
  type TeletypeMemoApplicationDependencies,
} from "../src/core/teletypeMemoApplication";
import { TeletypeMemoCore } from "../src/core/teletypeMemoCore";

const draft = {
  title: "Daily notes",
  body: "## Summary\nApplication facade extracted.",
  sourceMemoIds: [1],
};

describe("TeletypeMemoApplication", () => {
  test("keeps AI and Notion dependencies lazy during local memo operations", () => {
    const fixture = createFixture();

    const memo = fixture.application.captureMemo("Remember this");

    expect(memo.body).toBe("Remember this");
    expect(fixture.application.getMemo(memo.id)).toEqual(memo);
    expect(fixture.application.listMemos()).toEqual([memo]);
    expect(fixture.application.listMemosByDate()).toEqual([memo]);
    expect(fixture.application.searchMemos("Remember")).toEqual([memo]);
    expect(fixture.calls).toEqual({ memoCore: 1, agent: 0, publisher: 0 });
  });

  test(
    "coordinates review, approved publishing, and connection inspection",
    async () => {
      const fixture = createFixture();

      const review = await fixture.application.startNotionReview(
        "Summarize today",
      );
      expect(review.snapshot()).toEqual({ status: "reviewing", draft });

      const page = await fixture.application.publishNotionReview(
        review.approve(),
      );
      expect(page).toEqual({
        id: "page-id",
        url: "https://notion.so/page-id",
      });

      await expect(
        fixture.application.inspectNotionConnection(),
      ).resolves.toEqual({
        workspace: { id: "workspace-id", name: "Workspace" },
        user: { id: "user-id", name: "User" },
        tools: [{ name: "notion-create-pages" }],
      });
      expect(fixture.calls).toEqual({ memoCore: 1, agent: 1, publisher: 1 });
    },
  );

  test("closes the memo core once and rejects later operations", () => {
    const fixture = createFixture();
    fixture.application.listMemos();

    fixture.application.close();
    fixture.application.close();

    expect(fixture.repository.closeCalls).toBe(1);
    expect(() => fixture.application.listMemos()).toThrow(
      "Teletype Memo application is closed",
    );
  });
});

function createFixture(): {
  application: TeletypeMemoApplication;
  calls: { memoCore: number; agent: number; publisher: number };
  repository: InMemoryMemoRepository;
} {
  const repository = new InMemoryMemoRepository();
  const calls = { memoCore: 0, agent: 0, publisher: 0 };
  const dependencies: TeletypeMemoApplicationDependencies = {
    openMemoCore() {
      calls.memoCore += 1;
      return new TeletypeMemoCore(repository);
    },
    createDraftAgent() {
      calls.agent += 1;
      return {
        async startReview() {
          return new DraftReviewSession(draft, {
            async reviseDraft() {
              return draft;
            },
          });
        },
      };
    },
    createPublisher() {
      calls.publisher += 1;
      return {
        async publish(review) {
          expect(review.status).toBe("approved");
          return { id: "page-id", url: "https://notion.so/page-id" };
        },
      };
    },
    async inspectNotionConnection() {
      return {
        workspace: { id: "workspace-id", name: "Workspace" },
        user: { id: "user-id", name: "User" },
        tools: [{ name: "notion-create-pages" }],
      };
    },
  };

  return {
    application: new TeletypeMemoApplication(dependencies),
    calls,
    repository,
  };
}

class InMemoryMemoRepository implements MemoRepository {
  private readonly memos: Memo[] = [];
  closeCalls = 0;

  create(body: string): Memo {
    const memo: Memo = {
      id: this.memos.length + 1,
      body,
      createdAt: "2026-08-31T00:00:00.000Z",
      updatedAt: "2026-08-31T00:00:00.000Z",
      project: null,
      projectRoot: null,
      title: null,
      summary: null,
      status: "raw",
    };
    this.memos.push(memo);
    return memo;
  }

  findById(id: number): Memo | null {
    return this.memos.find((memo) => memo.id === id) ?? null;
  }

  list(limit = 20): Memo[] {
    return this.memos.slice(0, limit);
  }

  listByDate(): Memo[] {
    return [...this.memos];
  }

  search(query: string, limit = 20): Memo[] {
    return this.memos
      .filter((memo) => memo.body.includes(query))
      .slice(0, limit);
  }

  close(): void {
    this.closeCalls += 1;
  }
}
