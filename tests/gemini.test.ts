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
      model: "gemini-3.7-flash",
      contents: "今日のメモをまとめて",
    });
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
