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
  closed = false;

  async listTools(): Promise<{
    tools: Array<{ name: string; description?: string }>;
  }> {
    return { tools: this.tools };
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}
