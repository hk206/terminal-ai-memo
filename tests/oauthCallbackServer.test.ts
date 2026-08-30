import { afterEach, describe, expect, test } from "bun:test";
import {
  startOAuthCallbackServer,
  type OAuthCallbackServer,
} from "../src/notion/oauthCallbackServer";

describe("OAuth callback server", () => {
  let server: OAuthCallbackServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  test("returns the authorization code when state matches", async () => {
    server = await startOAuthCallbackServer();
    const codePromise = server.waitForCode("expected-state");

    const response = await fetch(
      `${server.callbackUrl}?code=auth-code&state=expected-state`,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Authorization complete");
    expect(await codePromise).toBe("auth-code");
  });

  test("rejects a callback whose state does not match", async () => {
    server = await startOAuthCallbackServer();
    const codePromise = server.waitForCode("expected-state");
    const errorPromise = codePromise.catch((error: unknown) => error);

    const response = await fetch(
      `${server.callbackUrl}?code=auth-code&state=wrong-state`,
    );

    expect(response.status).toBe(400);
    await response.text();
    expect(await errorPromise).toEqual(
      new Error("Notion OAuth state did not match"),
    );
  });

  test("reports an authorization error from Notion", async () => {
    server = await startOAuthCallbackServer();
    const codePromise = server.waitForCode("expected-state");
    const errorPromise = codePromise.catch((error: unknown) => error);

    const response = await fetch(
      `${server.callbackUrl}?error=access_denied&error_description=Canceled`,
    );

    expect(response.status).toBe(400);
    await response.text();
    expect(await errorPromise).toEqual(
      new Error("Notion authorization failed: Canceled"),
    );
  });

  test("ignores unrelated browser requests", async () => {
    server = await startOAuthCallbackServer();

    const response = await fetch(new URL("/favicon.ico", server.callbackUrl));

    expect(response.status).toBe(404);
  });
});
