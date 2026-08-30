import { INTERNAL_APP_ID } from "../appMetadata";

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type SecurityCommandRunner = (
  args: string[],
) => Promise<CommandResult>;

export interface SecretStore {
  get(): Promise<string | null>;
  set(secret: string): Promise<void>;
  delete(): Promise<void>;
}

const DEFAULT_SERVICE = `${INTERNAL_APP_ID}.notion-mcp`;
const DEFAULT_ACCOUNT = "oauth";
const ITEM_NOT_FOUND_EXIT_CODE = 44;

export class KeychainSecretStore implements SecretStore {
  constructor(
    private readonly runSecurity: SecurityCommandRunner = runSecurityCommand,
    private readonly service = DEFAULT_SERVICE,
    private readonly account = DEFAULT_ACCOUNT,
  ) {}

  async get(): Promise<string | null> {
    const result = await this.runSecurity([
      "find-generic-password",
      "-a",
      this.account,
      "-s",
      this.service,
      "-w",
    ]);

    if (result.exitCode === ITEM_NOT_FOUND_EXIT_CODE) {
      return null;
    }

    assertCommandSucceeded(result, "read the Notion credentials");
    return result.stdout.replace(/\r?\n$/, "");
  }

  async set(secret: string): Promise<void> {
    if (secret.length === 0) {
      throw new Error("Cannot store an empty Keychain secret");
    }

    const result = await this.runSecurity([
      "add-generic-password",
      "-U",
      "-a",
      this.account,
      "-s",
      this.service,
      "-w",
      secret,
    ]);

    assertCommandSucceeded(result, "store the Notion credentials");
  }

  async delete(): Promise<void> {
    const result = await this.runSecurity([
      "delete-generic-password",
      "-a",
      this.account,
      "-s",
      this.service,
    ]);

    if (result.exitCode === ITEM_NOT_FOUND_EXIT_CODE) {
      return;
    }

    assertCommandSucceeded(result, "delete the Notion credentials");
  }
}

async function runSecurityCommand(args: string[]): Promise<CommandResult> {
  const process = Bun.spawn(["/usr/bin/security", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);

  return { exitCode, stdout, stderr };
}

function assertCommandSucceeded(
  result: CommandResult,
  operation: string,
): void {
  if (result.exitCode === 0) {
    return;
  }

  const detail = result.stderr.trim();
  throw new Error(
    `Failed to ${operation}${detail ? `: ${detail}` : ""}`,
  );
}
