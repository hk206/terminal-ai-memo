import { createInterface } from "node:readline";

export type MemoInputResult =
  | { kind: "submitted"; body: string }
  | { kind: "canceled" };

export function readMemoInput(
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<MemoInputResult> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    const readline = createInterface({
      input,
      output,
      terminal: Boolean((input as NodeJS.ReadStream).isTTY),
    });

    let finished = false;
    let canceled = false;

    output.write("> ");

    readline.on("line", (line) => {
      if (finished) {
        return;
      }

      if (line.length === 0) {
        finished = true;
        readline.close();
        return;
      }

      lines.push(line);
      output.write("> ");
    });

    readline.on("SIGINT", () => {
      finished = true;
      canceled = true;
      readline.close();
    });

    readline.on("close", () => {
      if (canceled) {
        resolve({ kind: "canceled" });
        return;
      }

      resolve({ kind: "submitted", body: lines.join("\n") });
    });
  });
}
