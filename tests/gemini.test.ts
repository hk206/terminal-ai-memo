import { describe, expect, test } from "bun:test";
import { GeminiAssistant } from "../src/gemini";

describe("GeminiAssistant", () => {
  test("returns trimmed model text", async () => {
    const assistant = new GeminiAssistant(async () => ({
      text: "  Gemini is connected.  ",
    }));

    await expect(assistant.ask("Say hello")).resolves.toBe(
      "Gemini is connected.",
    );
  });

  test("passes the instruction and default model to Gemini", async () => {
    const requests: unknown[] = [];
    const assistant = new GeminiAssistant(async (request) => {
      requests.push(request);
      return { text: "ok" };
    });

    await assistant.ask("今日のメモをまとめて");

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: "今日のメモをまとめて" }],
        },
      ],
    });
  });

  test("executes a requested tool and sends its result back to Gemini", async () => {
    const requests: any[] = [];
    const toolCalls: unknown[] = [];
    const assistant = new GeminiAssistant(async (request) => {
      requests.push(request);

      if (requests.length === 1) {
        return {
          functionCalls: [
            { id: "call-1", name: "listMemos", args: { limit: 5 } },
          ],
          candidateContent: {
            role: "model",
            parts: [
              {
                functionCall: {
                  id: "call-1",
                  name: "listMemos",
                  args: { limit: 5 },
                },
              },
            ],
          },
        };
      }

      return { text: "Found memo #1." };
    });

    const result = await assistant.ask("今日のメモをまとめて", {
      tools: [
        {
          name: "listMemos",
          description: "List memos",
          parameters: { type: "object" },
          async execute(args) {
            toolCalls.push(args);
            return JSON.stringify([{ id: 1, preview: "test memo" }]);
          },
        },
      ],
      now: new Date("2026-08-30T01:00:00.000Z"),
      timeZone: "Asia/Tokyo",
    });

    expect(result).toBe("Found memo #1.");
    expect(toolCalls).toEqual([{ limit: 5 }]);
    expect(requests).toHaveLength(2);
    expect(requests[1].contents.at(-1)).toEqual({
      role: "user",
      parts: [
        {
          functionResponse: {
            id: "call-1",
            name: "listMemos",
            response: {
              output: [{ id: 1, preview: "test memo" }],
            },
          },
        },
      ],
    });
  });

  test("returns tool errors to Gemini so it can recover", async () => {
    let requestCount = 0;
    const assistant = new GeminiAssistant(async (request) => {
      requestCount += 1;

      if (requestCount === 1) {
        return {
          functionCalls: [{ name: "missingTool", args: {} }],
          candidateContent: {
            role: "model",
            parts: [{ functionCall: { name: "missingTool", args: {} } }],
          },
        };
      }

      const contents = request.contents as Array<Record<string, unknown>>;
      expect(contents.at(-1)).toMatchObject({
        parts: [
          {
            functionResponse: {
              name: "missingTool",
              response: { error: "Tool missingTool not found" },
            },
          },
        ],
      });
      return { text: "I could not use that tool." };
    });

    await expect(
      assistant.ask("Use a missing tool", { tools: [] }),
    ).resolves.toBe("I could not use that tool.");
  });

  test("stops when the agent reaches its maximum step count", async () => {
    const assistant = new GeminiAssistant(async () => ({
      functionCalls: [{ name: "loopTool", args: {} }],
      candidateContent: {
        role: "model",
        parts: [{ functionCall: { name: "loopTool", args: {} } }],
      },
    }));

    await expect(
      assistant.ask("Keep calling", {
        tools: [
          {
            name: "loopTool",
            description: "Loop forever",
            parameters: { type: "object" },
            async execute() {
              return "ok";
            },
          },
        ],
        maxSteps: 2,
      }),
    ).rejects.toThrow("Agent reached the maximum step count (2)");
  });

  test("retries transient errors and eventually succeeds", async () => {
    let attempts = 0;
    const delays: number[] = [];
    const assistant = new GeminiAssistant(
      async () => {
        attempts += 1;

        if (attempts < 3) {
          throw Object.assign(new Error("temporarily unavailable"), {
            status: 503,
          });
        }

        return { text: "connected" };
      },
      "gemini-3.6-flash",
      {
        sleep: async (milliseconds) => {
          delays.push(milliseconds);
        },
        random: () => 0,
      },
    );

    await expect(assistant.ask("Say hello")).resolves.toBe("connected");
    expect(attempts).toBe(3);
    expect(delays).toEqual([1_000, 2_000]);
  });

  test("does not retry a non-transient error", async () => {
    let attempts = 0;
    const assistant = new GeminiAssistant(async () => {
      attempts += 1;
      throw Object.assign(new Error("invalid request"), { status: 400 });
    });

    await expect(assistant.ask("Say hello")).rejects.toThrow("invalid request");
    expect(attempts).toBe(1);
  });

  test("returns a helpful message after a 503 exhausts retries", async () => {
    const assistant = new GeminiAssistant(
      async () => {
        throw Object.assign(new Error("temporarily unavailable"), {
          status: 503,
        });
      },
      "gemini-3.7-flash",
      {
        maxAttempts: 2,
        sleep: async () => {},
        random: () => 0,
      },
    );

    await expect(assistant.ask("Say hello")).rejects.toThrow(
      'Gemini model "gemini-3.7-flash" is temporarily unavailable after retrying.',
    );
  });

  test("rejects an empty instruction", async () => {
    const assistant = new GeminiAssistant(async () => ({ text: "unused" }));

    await expect(assistant.ask("   ")).rejects.toThrow(
      "Instruction must not be empty",
    );
  });

  test("rejects an empty model response", async () => {
    const assistant = new GeminiAssistant(async () => ({ text: "   " }));

    await expect(assistant.ask("Say hello")).rejects.toThrow(
      "Gemini returned an empty response",
    );
  });
});
