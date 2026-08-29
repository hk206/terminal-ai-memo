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
      contents: "今日のメモをまとめて",
    });
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
