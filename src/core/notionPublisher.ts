import type { ApprovedDraftReviewState } from "./draftReviewSession";
import type { NotionPageDraft } from "../notion/draft";

export interface PublishedNotionPage {
  id: string;
  url: string;
}

export interface NotionPageDestination {
  createPage(draft: NotionPageDraft): Promise<PublishedNotionPage>;
}

export class NotionPublisher {
  constructor(private readonly destination: NotionPageDestination) {}

  publish(review: ApprovedDraftReviewState): Promise<PublishedNotionPage> {
    if ((review as { status: string }).status !== "approved") {
      throw new Error("Only an approved draft can be published to Notion");
    }

    return this.destination.createPage(review.draft);
  }
}
