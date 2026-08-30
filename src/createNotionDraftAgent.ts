import type { MemoReader } from "./core/memo";
import { NotionDraftAgent } from "./core/notionDraftAgent";
import { createGeminiAssistant } from "./gemini";
import { createMemoTools } from "./tools/memoTools";

export interface DraftRetryDetails {
  status: number;
  nextAttempt: number;
  maxAttempts: number;
  delayMilliseconds: number;
}

export interface CreateNotionDraftAgentOptions {
  onRetry?: (details: DraftRetryDetails) => void;
}

export function createNotionDraftAgent(
  memos: MemoReader,
  options: CreateNotionDraftAgentOptions = {},
): NotionDraftAgent {
  return new NotionDraftAgent(
    createGeminiAssistant({ onRetry: options.onRetry }),
    createMemoTools(memos),
  );
}
