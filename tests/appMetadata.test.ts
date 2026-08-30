import { describe, expect, test } from "bun:test";
import {
  APP_VERSION,
  createHelpText,
  INTERNAL_APP_ID,
  PRODUCT_NAME,
} from "../src/appMetadata";

describe("app metadata", () => {
  test("separates the product name from the compatibility identifier", () => {
    expect(PRODUCT_NAME).toBe("Teletype Memo");
    expect(INTERNAL_APP_ID).toBe("terminal-ai-memo");
  });

  test("builds help for the implemented commands", () => {
    const help = createHelpText();

    expect(help).toContain(`${PRODUCT_NAME} ${APP_VERSION}`);
    expect(help).toContain("memo ask <instruction>");
    expect(help).toContain("memo notion connect");
    expect(help).toContain("-h, --help");
    expect(help).toContain("-v, --version");
  });
});
