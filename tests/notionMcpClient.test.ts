import { describe, expect, test } from "bun:test";
import {
  connectToNotionMcp,
  NotionMcpConnection,
  type McpClientPort,
} from "../src/notion/mcpClient";

describe("NotionMcpConnection", () => {
  test("lists tools exposed by the MCP server", async () => {
    const client = new FakeMcpClient();
    client.tools = [
      { name: "notion-fetch", description: "Fetch a Notion page" },
      { name: "notion-create-pages" },
    ];
    const connection = new NotionMcpConnection(client);

    expect(await connection.listTools()).toEqual(client.tools);
  });

  test("reads the connected Notion workspace identity", async () => {
    const client = new FakeMcpClient();
    client.toolResult = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            self: {
              workspace: { id: "workspace-id", name: "My Workspace" },
              user: { id: "user-id", name: "Hokuto" },
            },
          }),
        },
      ],
    };
    const connection = new NotionMcpConnection(client);

    expect(await connection.getWorkspaceIdentity()).toEqual({
      workspace: { id: "workspace-id", name: "My Workspace" },
      user: { id: "user-id", name: "Hokuto" },
    });
    expect(client.toolCalls).toEqual([
      { name: "notion-fetch", arguments: { id: "self" } },
    ]);
  });

  test("creates a private Notion page from an approved draft", async () => {
    const client = new FakeMcpClient();
    client.toolResult = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            pages: [
              {
                id: "page-id",
                url: "https://www.notion.so/page-id",
              },
            ],
          }),
        },
      ],
    };
    const connection = new NotionMcpConnection(client);

    await expect(
      connection.createPage({
        title: "Learning log",
        body: "## Today\nLearned about MCP.",
        sourceMemoIds: [1],
      }),
    ).resolves.toEqual({
      id: "page-id",
      url: "https://www.notion.so/page-id",
    });
    expect(client.toolCalls).toEqual([
      {
        name: "notion-create-pages",
        arguments: {
          pages: [
            {
              properties: { title: "Learning log" },
              content: "## Today\nLearned about MCP.",
            },
          ],
        },
      },
    ]);
  });

  test("closes the underlying MCP client", async () => {
    const client = new FakeMcpClient();
    const connection = new NotionMcpConnection(client);

    await connection.close();

    expect(client.closed).toBe(true);
  });
});

test("connectToNotionMcp rejects an empty OAuth token before connecting", async () => {
  expect(connectToNotionMcp("  ")).rejects.toThrow(
    "A Notion OAuth access token is required",
  );
});

class FakeMcpClient implements McpClientPort {
  tools: Array<{ name: string; description?: string }> = [];
  toolResult: unknown = { content: [] };
  toolCalls: Array<{
    name: string;
    arguments?: Record<string, unknown>;
  }> = [];
  closed = false;

  async listTools(): Promise<{
    tools: Array<{ name: string; description?: string }>;
  }> {
    return { tools: this.tools };
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  async callTool(request: {
    name: string;
    arguments?: Record<string, unknown>;
  }): Promise<unknown> {
    this.toolCalls.push(request);
    return this.toolResult;
  }
}
