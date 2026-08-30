import type { NotionPageDraft } from "../notion/draft";

export interface DraftReviser {
  reviseDraft(
    draft: NotionPageDraft,
    revisionInstruction: string,
  ): Promise<NotionPageDraft>;
}

export type ReviewingDraftReviewState = {
  status: "reviewing";
  draft: NotionPageDraft;
};

export type ApprovedDraftReviewState = {
  status: "approved";
  draft: NotionPageDraft;
};

export type CanceledDraftReviewState = { status: "canceled" };

export type DraftReviewState =
  | ReviewingDraftReviewState
  | { status: "revising"; draft: NotionPageDraft }
  | ApprovedDraftReviewState
  | CanceledDraftReviewState;

export class DraftReviewSession {
  private state: DraftReviewState;

  constructor(
    draft: NotionPageDraft,
    private readonly reviser: DraftReviser,
  ) {
    this.state = { status: "reviewing", draft };
  }

  snapshot(): DraftReviewState {
    return this.state;
  }

  async revise(revisionInstruction: string): Promise<DraftReviewState> {
    const previous = this.requireReviewing("revise");
    this.state = { status: "revising", draft: previous.draft };

    try {
      const draft = await this.reviser.reviseDraft(
        previous.draft,
        revisionInstruction,
      );
      this.state = { status: "reviewing", draft };
      return this.state;
    } catch (error) {
      this.state = previous;
      throw error;
    }
  }

  approve(): ApprovedDraftReviewState {
    const current = this.requireReviewing("approve");
    this.state = { status: "approved", draft: current.draft };
    return this.state;
  }

  cancel(): CanceledDraftReviewState {
    this.requireReviewing("cancel");
    this.state = { status: "canceled" };
    return this.state;
  }

  private requireReviewing(action: string): ReviewingDraftReviewState {
    if (this.state.status !== "reviewing") {
      throw new Error(
        `Cannot ${action} draft review while status is ${this.state.status}`,
      );
    }

    return this.state;
  }
}
