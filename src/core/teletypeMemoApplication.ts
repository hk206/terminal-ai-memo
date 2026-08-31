import type { ListMemosOptions, Memo, MemoReader } from "./memo";
import type { CreateDraftOptions } from "./notionDraftAgent";
import type {
  ApprovedDraftReviewState,
  DraftReviewSession,
} from "./draftReviewSession";
import type { PublishedNotionPage } from "./notionPublisher";
import type { TeletypeMemoCore } from "./teletypeMemoCore";

export interface NotionConnectionSummary {
  workspace: { id: string; name: string };
  user: { id: string; name: string };
  tools: Array<{ name: string; description?: string }>;
}

export interface NotionDraftReviewStarter {
  startReview(
    instruction: string,
    options?: CreateDraftOptions,
  ): Promise<DraftReviewSession>;
}

export interface ApprovedNotionReviewPublisher {
  publish(review: ApprovedDraftReviewState): Promise<PublishedNotionPage>;
}

export interface TeletypeMemoApplicationDependencies {
  openMemoCore(): TeletypeMemoCore;
  createDraftAgent(memos: MemoReader): NotionDraftReviewStarter;
  createPublisher(): ApprovedNotionReviewPublisher;
  inspectNotionConnection(): Promise<NotionConnectionSummary>;
}

export class TeletypeMemoApplication {
  private memoCore: TeletypeMemoCore | undefined;
  private draftAgent: NotionDraftReviewStarter | undefined;
  private publisher: ApprovedNotionReviewPublisher | undefined;
  private closed = false;

  constructor(
    private readonly dependencies: TeletypeMemoApplicationDependencies,
  ) {}

  captureMemo(body: string): Memo {
    return this.memos().captureMemo(body);
  }

  getMemo(id: number): Memo | null {
    return this.memos().getMemo(id);
  }

  listMemos(limit = 20): Memo[] {
    return this.memos().listMemos(limit);
  }

  listMemosByDate(options: ListMemosOptions = {}): Memo[] {
    return this.memos().listMemosByDate(options);
  }

  searchMemos(query: string, limit = 20): Memo[] {
    return this.memos().searchMemos(query, limit);
  }

  startNotionReview(
    instruction: string,
    options: CreateDraftOptions = {},
  ): Promise<DraftReviewSession> {
    this.requireOpen();
    this.draftAgent ??= this.dependencies.createDraftAgent(this.memos());
    return this.draftAgent.startReview(instruction, options);
  }

  publishNotionReview(
    review: ApprovedDraftReviewState,
  ): Promise<PublishedNotionPage> {
    this.requireOpen();
    this.publisher ??= this.dependencies.createPublisher();
    return this.publisher.publish(review);
  }

  inspectNotionConnection(): Promise<NotionConnectionSummary> {
    this.requireOpen();
    return this.dependencies.inspectNotionConnection();
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.memoCore?.close();
  }

  private memos(): TeletypeMemoCore {
    this.requireOpen();
    this.memoCore ??= this.dependencies.openMemoCore();
    return this.memoCore;
  }

  private requireOpen(): void {
    if (this.closed) {
      throw new Error("Teletype Memo application is closed");
    }
  }
}
