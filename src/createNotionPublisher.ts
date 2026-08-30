import { NotionPublisher } from "./core/notionPublisher";
import {
  withNotionConnection,
  type NotionConnectionEvents,
} from "./notion/withNotionConnection";

export function createNotionPublisher(
  events: NotionConnectionEvents,
): NotionPublisher {
  return new NotionPublisher({
    createPage: (draft) =>
      withNotionConnection((connection) => connection.createPage(draft), events),
  });
}
