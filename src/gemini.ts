import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.6-flash";
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

interface GenerateContentRequest {
  model: string;
  contents: string;
  config: {
    systemInstruction: string;
  };
}

type GenerateContent = (
  request: GenerateContentRequest,
) => Promise<{ text?: string }>;

interface RetryOptions {
  maxAttempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  onRetry?: (details: {
    status: number;
    nextAttempt: number;
    maxAttempts: number;
    delayMilliseconds: number;
  }) => void;
}

export class GeminiAssistant {
  constructor(
    private readonly generateContent: GenerateContent,
    private readonly model: string = DEFAULT_MODEL,
    private readonly retryOptions: RetryOptions = {},
  ) {}

  async ask(instruction: string): Promise<string> {
    if (instruction.trim().length === 0) {
      throw new Error("Instruction must not be empty");
    }

    let response: { text?: string };

    try {
      response = await withTransientRetry(
        () =>
          this.generateContent({
            model: this.model,
            contents: instruction,
            config: {
              systemInstruction: [
                "You are the assistant for Terminal AI Memo.",
                "Reply in the same language as the user.",
                "You do not have access to local memos yet.",
                "If the request requires memo data, clearly state that the memo tools are not connected yet.",
              ].join("\n"),
            },
          }),
        this.retryOptions,
      );
    } catch (error) {
      throw createHelpfulError(error, this.model);
    }

    const text = response.text?.trim();

    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    return text;
  }
}

export function createGeminiAssistant(
  options: Pick<RetryOptions, "onRetry"> = {},
): GeminiAssistant {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Copy .env.example to .env and add your API key.",
    );
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const client = new GoogleGenAI({ apiKey });

  return new GeminiAssistant(
    (request) => client.models.generateContent(request),
    model,
    options,
  );
}

async function withTransientRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const sleep = options.sleep ?? wait;
  const random = options.random ?? Math.random;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = getErrorStatus(error);

      if (
        status === null ||
        !RETRYABLE_STATUS_CODES.has(status) ||
        attempt === maxAttempts
      ) {
        throw error;
      }

      const delayMilliseconds =
        1_000 * 2 ** (attempt - 1) + Math.floor(random() * 250);

      options.onRetry?.({
        status,
        nextAttempt: attempt + 1,
        maxAttempts,
        delayMilliseconds,
      });

      await sleep(delayMilliseconds);
    }
  }

  throw new Error("Gemini retry loop ended unexpectedly");
}

function getErrorStatus(error: unknown): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return null;
}

function createHelpfulError(error: unknown, model: string): Error {
  const status = getErrorStatus(error);

  if (status === 503) {
    return new Error(
      `Gemini model "${model}" is temporarily unavailable after retrying. ` +
        "Try again later or set GEMINI_MODEL=gemini-3.6-flash in .env.",
      { cause: error },
    );
  }

  if (status === 429) {
    return new Error(
      "Gemini rate limit reached after retrying. Wait before trying again.",
      { cause: error },
    );
  }

  return error instanceof Error ? error : new Error(String(error));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
