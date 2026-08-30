import { describe, expect, test } from "bun:test";
import {
  KeychainSecretStore,
  type CommandResult,
  type SecurityCommandRunner,
} from "../src/notion/keychainSecretStore";

describe("KeychainSecretStore", () => {
  test("reads a secret from a generic password item", async () => {
    const runner = new FakeSecurityRunner({
      exitCode: 0,
      stdout: "stored-secret\n",
      stderr: "",
    });
    const store = new KeychainSecretStore(runner.run);

    expect(await store.get()).toBe("stored-secret");
    expect(runner.calls).toEqual([
      [
        "find-generic-password",
        "-a",
        "oauth",
        "-s",
        "terminal-ai-memo.notion-mcp",
        "-w",
      ],
    ]);
  });

  test("returns null when the Keychain item does not exist", async () => {
    const runner = new FakeSecurityRunner({
      exitCode: 44,
      stdout: "",
      stderr: "item not found",
    });
    const store = new KeychainSecretStore(runner.run);

    expect(await store.get()).toBeNull();
  });

  test("stores a secret without invoking a shell", async () => {
    const runner = new FakeSecurityRunner(success());
    const store = new KeychainSecretStore(runner.run);

    await store.set("oauth-json");

    expect(runner.calls[0]).toEqual([
      "add-generic-password",
      "-U",
      "-a",
      "oauth",
      "-s",
      "terminal-ai-memo.notion-mcp",
      "-w",
      "oauth-json",
    ]);
  });

  test("rejects an empty secret before calling Keychain", async () => {
    const runner = new FakeSecurityRunner(success());
    const store = new KeychainSecretStore(runner.run);

    expect(store.set("")).rejects.toThrow(
      "Cannot store an empty Keychain secret",
    );
    expect(runner.calls).toEqual([]);
  });

  test("deleting an absent item is idempotent", async () => {
    const runner = new FakeSecurityRunner({
      exitCode: 44,
      stdout: "",
      stderr: "item not found",
    });
    const store = new KeychainSecretStore(runner.run);

    await expect(store.delete()).resolves.toBeUndefined();
  });
});

class FakeSecurityRunner {
  calls: string[][] = [];

  constructor(private readonly result: CommandResult) {}

  run: SecurityCommandRunner = async (args) => {
    this.calls.push(args);
    return this.result;
  };
}

function success(): CommandResult {
  return { exitCode: 0, stdout: "", stderr: "" };
}
