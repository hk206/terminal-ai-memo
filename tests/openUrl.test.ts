import { expect, test } from "bun:test";
import { openExternalUrl } from "../src/notion/openUrl";

test("openExternalUrl reports whether macOS opened the URL", async () => {
  const openedUrl = new URL("https://example.com/authorize");
  let receivedUrl: URL | undefined;

  const opened = await openExternalUrl(openedUrl, async (url) => {
    receivedUrl = url;
    return 0;
  });

  expect(opened).toBe(true);
  expect(receivedUrl).toEqual(openedUrl);
});

test("openExternalUrl returns false when the open command fails", async () => {
  const opened = await openExternalUrl(
    new URL("https://example.com/authorize"),
    async () => 1,
  );

  expect(opened).toBe(false);
});
