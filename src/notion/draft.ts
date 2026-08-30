export type NotionPageDraft = {
  title: string;
  body: string;
  sourceMemoIds: number[];
};

export const NOTION_PAGE_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      description: "A concise title for the Notion page.",
    },
    body: {
      type: "string",
      description: "The Notion page body in Markdown, without repeating the title.",
    },
    sourceMemoIds: {
      type: "array",
      description: "IDs of the local memos used as sources.",
      items: { type: "integer", minimum: 1 },
    },
  },
  required: ["title", "body", "sourceMemoIds"],
} as const;

export function parseNotionPageDraft(text: string): NotionPageDraft {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned invalid JSON for the Notion page draft");
  }

  if (!isRecord(value)) {
    throw new Error("Gemini returned an invalid Notion page draft");
  }

  const title = readNonEmptyString(value.title, "title");
  const body = readNonEmptyString(value.body, "body");

  if (
    !Array.isArray(value.sourceMemoIds) ||
    value.sourceMemoIds.some(
      (id) => !Number.isSafeInteger(id) || (id as number) < 1,
    )
  ) {
    throw new Error("Notion page draft contains invalid source memo IDs");
  }

  return {
    title,
    body,
    sourceMemoIds: [...new Set(value.sourceMemoIds as number[])],
  };
}

export function formatNotionPageDraft(draft: NotionPageDraft): string {
  const sources =
    draft.sourceMemoIds.length > 0
      ? draft.sourceMemoIds.map((id) => `#${id}`).join(", ")
      : "None";

  return [
    "─".repeat(60),
    `Title: ${draft.title}`,
    "─".repeat(60),
    draft.body,
    "─".repeat(60),
    `Sources: ${sources}`,
    "─".repeat(60),
  ].join("\n");
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Notion page draft has an empty ${field}`);
  }

  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
