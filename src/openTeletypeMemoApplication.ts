import {
  TeletypeMemoApplication,
  type NotionConnectionSummary,
} from "./core/teletypeMemoApplication";
import {
  createNotionDraftAgent,
  type DraftRetryDetails,
} from "./createNotionDraftAgent";
import { createNotionPublisher } from "./createNotionPublisher";
import {
  withNotionConnection,
  type NotionConnectionEvents,
} from "./notion/withNotionConnection";
import { openTeletypeMemoCore } from "./openTeletypeMemoCore";

export interface TeletypeMemoApplicationEvents {
  onDraftRetry?: (details: DraftRetryDetails) => void;
  onNotionConnecting?: () => void;
  onNotionAuthorizationUrl?: (authorizationUrl: URL) => void | Promise<void>;
}

export interface OpenTeletypeMemoApplicationOptions {
  databasePath?: string;
  now?: () => Date;
  events?: TeletypeMemoApplicationEvents;
}

export function openTeletypeMemoApplication(
  options: OpenTeletypeMemoApplicationOptions = {},
): TeletypeMemoApplication {
  const notionEvents = createNotionConnectionEvents(options.events);

  return new TeletypeMemoApplication({
    openMemoCore: () =>
      openTeletypeMemoCore({
        databasePath: options.databasePath,
        now: options.now,
      }),
    createDraftAgent: (memos) =>
      createNotionDraftAgent(memos, {
        onRetry: options.events?.onDraftRetry,
      }),
    createPublisher: () => createNotionPublisher(notionEvents),
    inspectNotionConnection: () => inspectNotionConnection(notionEvents),
  });
}

async function inspectNotionConnection(
  events: NotionConnectionEvents,
): Promise<NotionConnectionSummary> {
  return withNotionConnection(async (connection) => {
    const [identity, tools] = await Promise.all([
      connection.getWorkspaceIdentity(),
      connection.listTools(),
    ]);

    return {
      workspace: identity.workspace,
      user: identity.user,
      tools,
    };
  }, events);
}

function createNotionConnectionEvents(
  events: TeletypeMemoApplicationEvents = {},
): NotionConnectionEvents {
  return {
    onConnecting: events.onNotionConnecting,
    onAuthorizationUrl: async (authorizationUrl) => {
      if (!events.onNotionAuthorizationUrl) {
        throw new Error(
          "Notion authorization requires an onNotionAuthorizationUrl handler",
        );
      }

      await events.onNotionAuthorizationUrl(authorizationUrl);
    },
  };
}
