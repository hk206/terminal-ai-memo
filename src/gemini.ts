import { GoogleGenAI } from "@google/genai";
import type {
  Content,
  FunctionCall,
  GenerateContentParameters,
} from "@google/genai";
import type { AgentTool } from "./tools/types";
import {
  NOTION_PAGE_DRAFT_SCHEMA,
  parseNotionPageDraft,
  type NotionPageDraft,
} from "./notion/draft";

const DEFAULT_MODEL = "gemini-3.6-flash";
const DEFAULT_MAX_STEPS = 6;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

interface ModelResponse {
  text?: string;
  functionCalls?: FunctionCall[];
  candidateContent?: Content;
}

type GenerateContent = (
  request: GenerateContentParameters,
) => Promise<ModelResponse>;

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

interface AskOptions {
  tools?: AgentTool[];
  maxSteps?: number;
  now?: Date;
  timeZone?: string;
  onToolCall?: (details: { name: string; args: unknown }) => void;
}

export class GeminiAssistant {
  constructor(
    private readonly generateContent: GenerateContent,
    private readonly model: string = DEFAULT_MODEL,
    private readonly retryOptions: RetryOptions = {},
  ) {}

  async ask(instruction: string, options: AskOptions = {}): Promise<string> {
    return this.runAgent(instruction, options, false);
  }

  async createNotionDraft(
    instruction: string,
    options: AskOptions = {},
  ): Promise<NotionPageDraft> {
    const response = await this.runAgent(instruction, options, true);
    return parseNotionPageDraft(response);
  }

  async reviseNotionDraft(
    draft: NotionPageDraft,
    revisionInstruction: string,
    options: Pick<AskOptions, "now" | "timeZone"> = {},
  ): Promise<NotionPageDraft> {
    if (revisionInstruction.trim().length === 0) {
      throw new Error("Revision instruction must not be empty");
    }

    const instruction = [
      "Revise the following Notion page draft according to the user's feedback.",
      "Keep the source memo IDs unless the feedback makes a source irrelevant.",
      "",
      "Current draft:",
      JSON.stringify(draft),
      "",
      "User feedback:",
      revisionInstruction,
    ].join("\n");
    const response = await this.runAgent(instruction, options, true);
    return parseNotionPageDraft(response);
  }

  private async runAgent(
    instruction: string,
    options: AskOptions,
    structuredDraft: boolean,
  ): Promise<string> {
    if (instruction.trim().length === 0) {
      throw new Error("Instruction must not be empty");
    }

    const tools = options.tools ?? [];
    const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
    const history: Content[] = [
      {
        role: "user",
        parts: [{ text: instruction }],
      },
    ];

    for (let step = 1; step <= maxSteps; step += 1) {
      const response = await this.generateWithRetry({
        model: this.model,
        contents: history,
        config: {
          systemInstruction: createSystemInstruction(options, structuredDraft),
          ...(structuredDraft && {
            responseMimeType: "application/json",
            responseJsonSchema: NOTION_PAGE_DRAFT_SCHEMA,
          }),
          ...(tools.length > 0 && {
            tools: [
              {
                functionDeclarations: tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  parametersJsonSchema: tool.parameters,
                })),
              },
            ],
          }),
        },
      });

      const functionCalls = response.functionCalls ?? [];

      if (functionCalls.length === 0) {
        const text = response.text?.trim();

        if (!text) {
          throw new Error("Gemini returned an empty response");
        }

        return text;
      }

      history.push(
        response.candidateContent ?? createModelFunctionCallContent(functionCalls),
      );

      const functionResponseParts = [];

      for (const functionCall of functionCalls) {
        const name = functionCall.name ?? "unknownTool";
        const args = functionCall.args ?? {};
        const tool = tools.find((candidate) => candidate.name === name);

        options.onToolCall?.({ name, args });

        try {
          if (!tool) {
            throw new Error(`Tool ${name} not found`);
          }

          const output = await tool.execute(args);
          functionResponseParts.push({
            functionResponse: {
              id: functionCall.id,
              name,
              response: { output: parseToolOutput(output) },
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          functionResponseParts.push({
            functionResponse: {
              id: functionCall.id,
              name,
              response: { error: message },
            },
          });
        }
      }

      history.push({ role: "user", parts: functionResponseParts });
    }

    throw new Error(`Agent reached the maximum step count (${maxSteps})`);
  }

  private async generateWithRetry(
    request: GenerateContentParameters,
  ): Promise<ModelResponse> {
    try {
      return await withTransientRetry(
        () => this.generateContent(request),
        this.retryOptions,
      );
    } catch (error) {
      throw createHelpfulError(error, this.model);
    }
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

  return new GeminiAssistant(async (request) => {
    const response = await client.models.generateContent(request);
    const candidateContent = response.candidates?.[0]?.content;
    const text = candidateContent?.parts
      ?.map((part) => part.text ?? "")
      .join("");

    return {
      text,
      functionCalls: response.functionCalls,
      candidateContent,
    };
  }, model, options);
}

function createSystemInstruction(
  options: AskOptions,
  structuredDraft: boolean,
): string {
  const now = options.now ?? new Date();
  const timeZone =
    options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const instructions = [
    "You are the assistant for Terminal AI Memo.",
    "Reply in the same language as the user.",
    `Current datetime: ${now.toISOString()}`,
    `User timezone: ${timeZone}`,
    "Use the memo tools whenever the request depends on local memo data.",
    "listMemos and searchMemos return previews; use readMemo for the full text of relevant memos.",
    "Never claim to have read a memo unless a tool returned it.",
    "Mention the source memo IDs in the final answer.",
    "Never claim to create or update a Notion page; the CLI handles writes after user approval.",
  ];

  if (structuredDraft) {
    instructions.push(
      "Return a Notion page draft matching the requested JSON schema.",
      "Write the body as readable Markdown and do not repeat the title in the body.",
      "sourceMemoIds must contain only local memo IDs actually used as sources.",
    );
  }

  return instructions.join("\n");
}

function createModelFunctionCallContent(functionCalls: FunctionCall[]): Content {
  return {
    role: "model",
    parts: functionCalls.map((functionCall) => ({ functionCall })),
  };
}

function parseToolOutput(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
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
