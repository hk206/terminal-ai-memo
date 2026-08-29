import { emitKeypressEvents, type Key } from "node:readline";

export interface SelectOption<T> {
  label: string;
  value: T;
}

export function selectOption<T>(
  options: SelectOption<T>[],
  input: NodeJS.ReadStream = process.stdin,
  output: NodeJS.WriteStream = process.stdout,
): Promise<T | null> {
  if (options.length === 0) {
    return Promise.resolve(null);
  }

  if (!input.isTTY || !output.isTTY) {
    throw new Error("Interactive selection requires a terminal");
  }

  emitKeypressEvents(input);

  const wasRaw = input.isRaw;
  let selectedIndex = 0;
  let hasRendered = false;

  input.setRawMode(true);
  input.resume();
  renderOptions(options, selectedIndex, output, hasRendered);
  hasRendered = true;

  return new Promise((resolve) => {
    const finish = (value: T | null): void => {
      input.off("keypress", onKeypress);
      input.setRawMode(wasRaw);
      input.pause();
      output.write("\n");
      resolve(value);
    };

    const onKeypress = (_character: string, key: Key): void => {
      if (key.name === "up" || key.name === "k") {
        selectedIndex = moveSelection(selectedIndex, -1, options.length);
        renderOptions(options, selectedIndex, output, hasRendered);
        return;
      }

      if (key.name === "down" || key.name === "j") {
        selectedIndex = moveSelection(selectedIndex, 1, options.length);
        renderOptions(options, selectedIndex, output, hasRendered);
        return;
      }

      if (key.name === "return") {
        finish(options[selectedIndex]!.value);
        return;
      }

      if (key.name === "escape" || (key.ctrl && key.name === "c")) {
        finish(null);
      }
    };

    input.on("keypress", onKeypress);
  });
}

export function moveSelection(
  currentIndex: number,
  direction: -1 | 1,
  optionCount: number,
): number {
  return (currentIndex + direction + optionCount) % optionCount;
}

function renderOptions<T>(
  options: SelectOption<T>[],
  selectedIndex: number,
  output: NodeJS.WriteStream,
  redraw: boolean,
): void {
  const lineCount = options.length + 1;

  if (redraw) {
    output.write(`\u001B[${lineCount}F`);
  }

  output.write("\u001B[2KSelect a memo — ↑/↓ or j/k, Enter to open, Esc to cancel\n");

  options.forEach((option, index) => {
    const marker = index === selectedIndex ? "❯" : " ";
    output.write(`\u001B[2K${marker} ${option.label}\n`);
  });
}
