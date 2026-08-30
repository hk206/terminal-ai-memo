import { TeletypeMemoCore } from "./core/teletypeMemoCore";
import { MemoStore } from "./store";

export interface OpenTeletypeMemoCoreOptions {
  databasePath?: string;
  now?: () => Date;
}

export function openTeletypeMemoCore(
  options: OpenTeletypeMemoCoreOptions = {},
): TeletypeMemoCore {
  return new TeletypeMemoCore(
    new MemoStore(options.databasePath, options.now),
  );
}
