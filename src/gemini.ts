import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.7-flash";

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

export class GeminiAssistant {
  constructor(
    private readonly generateContent: GenerateContent,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  async ask(instruction: string): Promise<string> {
    if (instruction.trim().length === 0) {
      throw new Error("Instruction must not be empty");
    }

    const response = await this.generateContent({
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
    });

    const text = response.text?.trim();

    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    return text;
  }
}

export function createGeminiAssistant(): GeminiAssistant {
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
  );
}
