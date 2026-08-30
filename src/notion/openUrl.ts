export type OpenCommandRunner = (url: URL) => Promise<number>;

export async function openExternalUrl(
  url: URL,
  runOpen: OpenCommandRunner = runOpenCommand,
): Promise<boolean> {
  return (await runOpen(url)) === 0;
}

async function runOpenCommand(url: URL): Promise<number> {
  const process = Bun.spawn(["/usr/bin/open", url.toString()], {
    stdout: "ignore",
    stderr: "ignore",
  });

  return process.exited;
}
