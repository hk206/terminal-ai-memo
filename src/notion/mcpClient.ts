import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  UnauthorizedError,
  type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";

export const NOTION_MCP_URL = "https://mcp.notion.com/mcp";

export type NotionMcpTool = {
  name: string;
  description?: string;
};

export type NotionWorkspaceIdentity = {
  workspace: { id: string; name: string };
  user: { id: string; name: string };
};

export interface McpClientPort {
  listTools(): Promise<{
    tools: Array<{ name: string; description?: string }>;
  }>;
  callTool(request: {
    name: string;
    arguments?: Record<string, unknown>;
  }): Promise<unknown>;
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

  async getWorkspaceIdentity(): Promise<NotionWorkspaceIdentity> {
    const result = await this.client.callTool({
      name: "notion-fetch",
      arguments: { id: "self" },
    });
    const payload = parseTextToolResult(result);
    const self = readRecord(payload, "self");
    const workspace = readRecord(self, "workspace");
    const user = readRecord(self, "user");

    return {
      workspace: {
        id: readString(workspace, "id"),
        name: readString(workspace, "name"),
      },
      user: {
        id: readString(user, "id"),
        name: readString(user, "name"),
      },
    };
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

  return new NotionMcpConnection(adaptClient(client));
}

export async function connectToNotionMcpWithOAuth(
  provider: OAuthClientProvider,
  waitForAuthorizationCode: () => Promise<string>,
): Promise<NotionMcpConnection> {
  const firstAttempt = createOAuthClient(provider);

  try {
    await firstAttempt.client.connect(firstAttempt.transport);
    return new NotionMcpConnection(adaptClient(firstAttempt.client));
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) {
      await closeQuietly(firstAttempt.client);
      throw error;
    }

    try {
      const authorizationCode = await waitForAuthorizationCode();
      await firstAttempt.transport.finishAuth(authorizationCode);
    } finally {
      await closeQuietly(firstAttempt.client);
    }
  }

  const secondAttempt = createOAuthClient(provider);

  try {
    await secondAttempt.client.connect(secondAttempt.transport);
    return new NotionMcpConnection(adaptClient(secondAttempt.client));
  } catch (error) {
    await closeQuietly(secondAttempt.client);
    throw error;
  }
}

function createOAuthClient(provider: OAuthClientProvider): {
  client: Client;
  transport: StreamableHTTPClientTransport;
} {
  const client = new Client({
    name: "terminal-ai-memo",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(
    new URL(NOTION_MCP_URL),
    { authProvider: provider },
  );

  return { client, transport };
}

function adaptClient(client: Client): McpClientPort {
  return {
    listTools: () => client.listTools(),
    callTool: (request) => client.callTool(request),
    close: () => client.close(),
  };
}

async function closeQuietly(client: Client): Promise<void> {
  try {
    await client.close();
  } catch {
    // A failed initialize handshake may leave nothing to close.
  }
}

function parseTextToolResult(result: unknown): unknown {
  if (!isRecord(result) || !Array.isArray(result.content)) {
    throw new Error("Notion MCP returned an invalid Tool result");
  }

  const textBlock = result.content.find(
    (block) =>
      isRecord(block) && block.type === "text" && typeof block.text === "string",
  );

  if (!isRecord(textBlock) || typeof textBlock.text !== "string") {
    throw new Error("Notion MCP did not return a text result");
  }

  try {
    return JSON.parse(textBlock.text);
  } catch {
    throw new Error("Notion MCP returned invalid JSON");
  }
}

function readRecord(value: unknown, key: string): Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value[key])) {
    throw new Error(`Notion MCP response is missing ${key}`);
  }

  return value[key];
}

function readString(value: Record<string, unknown>, key: string): string {
  if (typeof value[key] !== "string" || value[key].length === 0) {
    throw new Error(`Notion MCP response is missing ${key}`);
  }

  return value[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
