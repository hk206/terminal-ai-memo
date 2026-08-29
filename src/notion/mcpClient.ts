import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const NOTION_MCP_URL = "https://mcp.notion.com/mcp";

export type NotionMcpTool = {
  name: string;
  description?: string;
};

export interface McpClientPort {
  listTools(): Promise<{
    tools: Array<{ name: string; description?: string }>;
  }>;
  close(): Promise<void>;
}

export class NotionMcpConnection {
  constructor(private readonly client: McpClientPort) {}

  async listTools(): Promise<NotionMcpTool[]> {
    const { tools } = await this.client.listTools();

    return tools.map(({ name, description }) => ({
      name,
      ...(description ? { description } : {}),
    }));
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export async function connectToNotionMcp(
  accessToken: string,
): Promise<NotionMcpConnection> {
  if (accessToken.trim().length === 0) {
    throw new Error("A Notion OAuth access token is required");
  }

  const client = new Client({
    name: "terminal-ai-memo",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(
    new URL(NOTION_MCP_URL),
    {
      requestInit: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "terminal-ai-memo/0.1.0",
        },
      },
    },
  );

  await client.connect(transport);

  return new NotionMcpConnection(client);
}
