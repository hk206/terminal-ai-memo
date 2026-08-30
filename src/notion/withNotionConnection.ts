import { KeychainSecretStore } from "./keychainSecretStore";
import {
  connectToNotionMcpWithOAuth,
  type NotionMcpConnection,
} from "./mcpClient";
import {
  startOAuthCallbackServer,
  type OAuthCallbackServer,
} from "./oauthCallbackServer";
import { NotionOAuthProvider } from "./oauthProvider";

export type NotionConnectionPort = Pick<
  NotionMcpConnection,
  "close" | "createPage" | "getWorkspaceIdentity" | "listTools"
>;

export interface NotionConnectionEvents {
  onConnecting?: () => void;
  onAuthorizationUrl: (authorizationUrl: URL) => void | Promise<void>;
}

export interface NotionConnectionDependencies {
  startCallbackServer(): Promise<OAuthCallbackServer>;
  connect(
    callbackServer: OAuthCallbackServer,
    onAuthorizationUrl: (authorizationUrl: URL) => void | Promise<void>,
  ): Promise<NotionConnectionPort>;
}

const DEFAULT_DEPENDENCIES: NotionConnectionDependencies = {
  startCallbackServer: () => startOAuthCallbackServer(),
  async connect(callbackServer, onAuthorizationUrl) {
    const provider = new NotionOAuthProvider(
      new KeychainSecretStore(),
      callbackServer.callbackUrl,
      onAuthorizationUrl,
    );
    const authorizationCode = callbackServer.waitForCode(provider.state());

    return connectToNotionMcpWithOAuth(provider, () => authorizationCode);
  },
};

export async function withNotionConnection<T>(
  operation: (connection: NotionConnectionPort) => Promise<T>,
  events: NotionConnectionEvents,
  dependencies: NotionConnectionDependencies = DEFAULT_DEPENDENCIES,
): Promise<T> {
  const callbackServer = await dependencies.startCallbackServer();
  let connection: NotionConnectionPort | undefined;

  try {
    events.onConnecting?.();
    connection = await dependencies.connect(
      callbackServer,
      events.onAuthorizationUrl,
    );
    return await operation(connection);
  } finally {
    try {
      await connection?.close();
    } finally {
      await callbackServer.close();
    }
  }
}
