import type { Memo } from "../core/memo";
import type { TeletypeMemoCore } from "../core/teletypeMemoCore";
import type { AgentTool } from "./types";

type MemoReader = Pick<
  TeletypeMemoCore,
  "getMemo" | "listMemosByDate" | "searchMemos"
>;

export function createMemoTools(memos: MemoReader): AgentTool[] {
  return [
    createListMemosTool(memos),
    createSearchMemosTool(memos),
    createReadMemoTool(memos),
  ];
}

function createListMemosTool(memos: MemoReader): AgentTool {
  return {
    name: "listMemos",
    description:
      "List recent memos, optionally restricted to an ISO 8601 date range. " +
      "Use this for requests about today, this week, or a recent period.",
    parameters: {
      type: "object",
      properties: {
        createdFrom: {
          type: "string",
          description: "Inclusive ISO 8601 start datetime.",
        },
        createdTo: {
          type: "string",
          description: "Exclusive ISO 8601 end datetime.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Maximum number of memos. Defaults to 20.",
        },
      },
      additionalProperties: false,
    },
    async execute(args: unknown): Promise<string> {
      const input = readObject(args);
      const createdFrom = readOptionalDate(input.createdFrom, "createdFrom");
      const createdTo = readOptionalDate(input.createdTo, "createdTo");
      const limit = readOptionalLimit(input.limit);

      const results = memos.listMemosByDate({ createdFrom, createdTo, limit });
      return JSON.stringify(results.map(toMemoSummary));
    },
  };
}

function createSearchMemosTool(memos: MemoReader): AgentTool {
  return {
    name: "searchMemos",
    description:
      "Search memo bodies by a literal keyword or phrase. " +
      "Use this when the request refers to a topic rather than a date range.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          minLength: 1,
          description: "Keyword or phrase to search for.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Maximum number of matches. Defaults to 20.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    async execute(args: unknown): Promise<string> {
      const input = readObject(args);
      const query = readRequiredString(input.query, "query");
      const limit = readOptionalLimit(input.limit);

      const results = memos.searchMemos(query, limit);
      return JSON.stringify(results.map(toMemoSummary));
    },
  };
}

function createReadMemoTool(memos: MemoReader): AgentTool {
  return {
    name: "readMemo",
    description:
      "Read the full original body and metadata of one memo by ID. " +
      "Use this after listMemos or searchMemos identifies a relevant memo.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "integer",
          minimum: 1,
          description: "Memo ID.",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(args: unknown): Promise<string> {
      const input = readObject(args);
      const id = readRequiredPositiveInteger(input.id, "id");
      const memo = memos.getMemo(id);

      if (!memo) {
        throw new Error(`Memo #${id} not found`);
      }

      return JSON.stringify(memo);
    },
  };
}

function toMemoSummary(memo: Memo): {
  id: number;
  createdAt: string;
  status: Memo["status"];
  preview: string;
} {
  const singleLineBody = memo.body.replace(/\n/g, " / ");

  return {
    id: memo.id,
    createdAt: memo.createdAt,
    status: memo.status,
    preview:
      singleLineBody.length <= 200
        ? singleLineBody
        : `${singleLineBody.slice(0, 199)}…`,
  };
}

function readObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Tool arguments must be an object");
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }

  return value.trim();
}

function readRequiredPositiveInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value as number;
}

function readOptionalLimit(value: unknown): number {
  if (value === undefined) {
    return 20;
  }

  const limit = readRequiredPositiveInteger(value, "limit");

  if (limit > 100) {
    throw new Error("limit must not exceed 100");
  }

  return limit;
}

function readOptionalDate(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${name} must be a valid ISO 8601 datetime`);
  }

  return new Date(value).toISOString();
}
