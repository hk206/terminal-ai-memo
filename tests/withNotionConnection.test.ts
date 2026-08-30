import { describe, expect, test } from "bun:test";
import type { OAuthCallbackServer } from "../src/notion/oauthCallbackServer";
import {
  withNotionConnection,
  type NotionConnectionDependencies,
  type NotionConnectionPort,
} from "../src/notion/withNotionConnection";

describe("withNotionConnection", () => {
  test("forwards events, runs the operation, and closes resources", async () => {
    const events: string[] = [];
    const server = createFakeServer();
    const connection = createFakeConnection();
    const dependencies = createDependencies(server, async (_, onUrl) => {
      events.push("connect");
      await onUrl(new URL("https://notion.example/authorize"));
      return connection;
    });

    const result = await withNotionConnection(
      async () => {
        events.push("operation");
        return "done";
      },
      {
        onConnecting: () => {
          events.push("connecting");
        },
        onAuthorizationUrl: (url) => {
          events.push(`authorize:${url.host}`);
        },
      },
      dependencies,
    );

    expect(result).toBe("done");
    expect(events).toEqual([
      "connecting",
      "connect",
      "authorize:notion.example",
      "operation",
    ]);
    expect(connection.closed).toBe(true);
    expect(server.closed).toBe(true);
  });

  test("closes the callback server when connecting fails", async () => {
    const server = createFakeServer();
    const dependencies = createDependencies(server, async () => {
      throw new Error("connection failed");
    });

    await expect(
      withNotionConnection(
        async () => "unused",
        { onAuthorizationUrl: () => {} },
        dependencies,
      ),
    ).rejects.toThrow("connection failed");
    expect(server.closed).toBe(true);
  });

  test("closes the callback server even when connection close fails", async () => {
    const server = createFakeServer();
    const connection = createFakeConnection();
    connection.close = async () => {
      throw new Error("close failed");
    };
    const dependencies = createDependencies(server, async () => connection);

    await expect(
      withNotionConnection(
        async () => "done",
        { onAuthorizationUrl: () => {} },
        dependencies,
      ),
    ).rejects.toThrow("close failed");
    expect(server.closed).toBe(true);
  });
});

type FakeServer = OAuthCallbackServer & { closed: boolean };
type FakeConnection = NotionConnectionPort & { closed: boolean };

function createFakeServer(): FakeServer {
  return {
    callbackUrl: new URL("http://127.0.0.1:43119/callback"),
    closed: false,
    async waitForCode() {
      return "authorization-code";
    },
    async close() {
      this.closed = true;
    },
  };
}

function createFakeConnection(): FakeConnection {
  return {
    closed: false,
    async listTools() {
      return [];
    },
    async getWorkspaceIdentity() {
      return {
        workspace: { id: "workspace-id", name: "Workspace" },
        user: { id: "user-id", name: "User" },
      };
    },
    async createPage() {
      return { id: "page-id", url: "https://notion.so/page-id" };
    },
    async close() {
      this.closed = true;
    },
  };
}

function createDependencies(
  server: OAuthCallbackServer,
  connect: NotionConnectionDependencies["connect"],
): NotionConnectionDependencies {
  return {
    async startCallbackServer() {
      return server;
    },
    connect,
  };
}
