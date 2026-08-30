import { createServer, type Server } from "node:http";

export type OAuthCallbackServer = {
  callbackUrl: URL;
  waitForCode(expectedState: string): Promise<string>;
  close(): Promise<void>;
};

export const NOTION_OAUTH_CALLBACK_PORT = 43119;

export async function startOAuthCallbackServer(
  port = NOTION_OAUTH_CALLBACK_PORT,
): Promise<OAuthCallbackServer> {
  let expectedState: string | undefined;
  let resolveCode: ((code: string) => void) | undefined;
  let rejectCode: ((error: Error) => void) | undefined;
  let codePromise: Promise<string> | undefined;

  const server = createServer((request, response) => {
    const requestUrl = new URL(
      request.url ?? "/",
      "http://127.0.0.1",
    );

    if (requestUrl.pathname !== "/callback") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    if (!expectedState || !resolveCode || !rejectCode) {
      response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("OAuth callback is not ready");
      return;
    }

    const error = requestUrl.searchParams.get("error");
    if (error) {
      const description =
        requestUrl.searchParams.get("error_description") ?? error;
      rejectCode(new Error(`Notion authorization failed: ${description}`));
      sendBrowserResult(response, false, "Notion authorization was canceled.");
      return;
    }

    if (requestUrl.searchParams.get("state") !== expectedState) {
      rejectCode(new Error("Notion OAuth state did not match"));
      sendBrowserResult(response, false, "Invalid OAuth state.");
      return;
    }

    const code = requestUrl.searchParams.get("code");
    if (!code) {
      rejectCode(new Error("Notion OAuth callback did not include a code"));
      sendBrowserResult(response, false, "Authorization code was missing.");
      return;
    }

    resolveCode(code);
    sendBrowserResult(
      response,
      true,
      "Connected. You can close this window and return to the terminal.",
    );
  });

  await listen(server, port);
  const address = server.address();

  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("Could not determine the OAuth callback port");
  }

  return {
    callbackUrl: new URL(`http://127.0.0.1:${address.port}/callback`),
    waitForCode(state: string): Promise<string> {
      if (codePromise) {
        throw new Error("OAuth callback is already being awaited");
      }

      expectedState = state;
      codePromise = new Promise<string>((resolve, reject) => {
        resolveCode = resolve;
        rejectCode = reject;
      });
      return codePromise;
    },
    close: () => closeServer(server),
  };
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function sendBrowserResult(
  response: import("node:http").ServerResponse,
  success: boolean,
  message: string,
): void {
  response.writeHead(success ? 200 : 400, {
    "Content-Type": "text/html; charset=utf-8",
  });
  response.end(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Terminal AI Memo</title></head>
  <body>
    <h1>${success ? "Authorization complete" : "Authorization failed"}</h1>
    <p>${message}</p>
  </body>
</html>`);
}
