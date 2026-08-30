import type { NotionPageDraft } from "../notion/draft";
import type { AgentTool } from "../tools/types";

export interface DraftToolCall {
  name: string;
  args: unknown;
}

export interface CreateDraftOptions {
  onToolCall?: (details: DraftToolCall) => void;
}

export interface DraftModel {
  createNotionDraft(
    instruction: string,
    options: {
      tools: AgentTool[];
      onToolCall?: (details: DraftToolCall) => void;
    },
  ): Promise<NotionPageDraft>;
  reviseNotionDraft(
    draft: NotionPageDraft,
    revisionInstruction: string,
  ): Promise<NotionPageDraft>;
}

export class NotionDraftAgent {
  constructor(
    private readonly model: DraftModel,
    private readonly memoTools: AgentTool[],
  ) {}

  createDraft(
    instruction: string,
    options: CreateDraftOptions = {},
  ): Promise<NotionPageDraft> {
    return this.model.createNotionDraft(instruction, {
      tools: this.memoTools,
      onToolCall: options.onToolCall,
    });
  }

  reviseDraft(
    draft: NotionPageDraft,
    revisionInstruction: string,
  ): Promise<NotionPageDraft> {
    return this.model.reviseNotionDraft(draft, revisionInstruction);
  }
}
