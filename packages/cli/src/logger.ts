import { emitKeypressEvents } from "node:readline";
import type { Readable, Writable } from "node:stream";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEvent {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface LoggerOptions {
  readonly format?: "json" | "human";
  readonly output?: Writable;
  readonly input?: NodeJS.ReadStream;
  readonly interactive?: boolean;
}

const colors: Record<LogLevel, string> = {
  debug: "\u001b[90m",
  info: "\u001b[36m",
  warn: "\u001b[33m",
  error: "\u001b[31m",
};

const reset = "\u001b[0m";

const isLogEvent = (value: unknown): value is LogEvent => {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Partial<LogEvent>;
  return (
    typeof event.timestamp === "string" &&
    (event.level === "debug" ||
      event.level === "info" ||
      event.level === "warn" ||
      event.level === "error") &&
    typeof event.message === "string"
  );
};

const compactData = (event: LogEvent): string =>
  event.data === undefined ? "" : ` ${JSON.stringify(event.data)}`;

class HumanView {
  private readonly entries: LogEvent[] = [];
  private readonly expanded = new Set<number>();
  private selected = 0;
  private readonly onKeypress: (
    input: string,
    key: { name?: string; sequence?: string; ctrl?: boolean },
  ) => void;

  constructor(
    private readonly output: Writable,
    private readonly input: NodeJS.ReadStream,
  ) {
    this.onKeypress = (_input, key) => {
      if (key.ctrl === true && key.name === "c") {
        process.kill(process.pid, "SIGINT");
        return;
      }
      if (key.name === "up") this.selected = Math.max(0, this.selected - 1);
      if (key.name === "down") {
        this.selected = Math.min(this.entries.length - 1, this.selected + 1);
      }
      if (key.name === "return" || key.name === "space") {
        if (this.expanded.has(this.selected))
          this.expanded.delete(this.selected);
        else this.expanded.add(this.selected);
      }
      this.render();
    };
    emitKeypressEvents(input);
    input.on("keypress", this.onKeypress);
    input.setRawMode?.(true);
    input.resume();
  }

  add(event: LogEvent): void {
    this.entries.push(event);
    this.selected = this.entries.length - 1;
    this.render();
  }

  close(): void {
    this.input.off("keypress", this.onKeypress);
    if (this.input.isTTY) this.input.setRawMode(false);
    this.output.write("\u001b[?25h");
  }

  private render(): void {
    const lines = [
      "\u001b[2J\u001b[H",
      "Smite logs  (up/down, enter or space to expand JSON)",
    ];
    this.entries.forEach((event, index) => {
      const marker = index === this.selected ? "▸" : " ";
      const time = event.timestamp.slice(11, 19);
      const level = event.level.toUpperCase().padEnd(5);
      lines.push(
        `${marker} ${time} ${colors[event.level]}${level}${reset} ${event.message}${compactData(event)}`,
      );
      if (this.expanded.has(index)) {
        lines.push(
          ...JSON.stringify(event, null, 2)
            .split("\n")
            .map((line) => `    ${line}`),
        );
      }
    });
    this.output.write(`${lines.join("\n")}\n`);
  }
}

export class Logger {
  private readonly format: "json" | "human";
  private readonly output: Writable;
  private readonly view: HumanView | undefined;
  private readonly readers = new Set<{ close: () => void }>();

  constructor(options: LoggerOptions = {}) {
    this.format = options.format ?? "json";
    this.output = options.output ?? process.stdout;
    const input = options.input ?? process.stdin;
    const outputIsTTY =
      (this.output as Writable & { readonly isTTY?: boolean }).isTTY === true;
    const interactive =
      this.format === "human" &&
      (options.interactive ?? (outputIsTTY && input.isTTY === true));
    this.view = interactive ? new HumanView(this.output, input) : undefined;
    if (this.view !== undefined) this.output.write("\u001b[?25l");
  }

  debug(message: string, data?: Readonly<Record<string, unknown>>): void {
    this.write("debug", message, data);
  }

  info(message: string, data?: Readonly<Record<string, unknown>>): void {
    this.write("info", message, data);
  }

  warn(message: string, data?: Readonly<Record<string, unknown>>): void {
    this.write("warn", message, data);
  }

  error(message: string, data?: Readonly<Record<string, unknown>>): void {
    this.write("error", message, data);
  }

  attach(stream: Readable, level: LogLevel = "info"): void {
    let buffer = "";
    const reader = {
      close: () => stream.off("data", onData),
    };
    const onData = (chunk: Buffer | string): void => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/u);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.length > 0) this.fromLine(line, level);
      }
    };
    stream.on("data", onData);
    stream.once("end", () => {
      if (buffer.length > 0) this.fromLine(buffer, level);
      this.readers.delete(reader);
    });
    this.readers.add(reader);
  }

  fromLine(line: string, fallbackLevel: LogLevel = "info"): void {
    try {
      const value: unknown = JSON.parse(line);
      if (isLogEvent(value)) {
        this.writeEvent(value);
        return;
      }
    } catch {
      // Child processes may still emit ordinary text.
    }
    this.write(fallbackLevel, line);
  }

  close(): void {
    for (const reader of this.readers) reader.close();
    this.readers.clear();
    this.view?.close();
  }

  private write(
    level: LogLevel,
    message: string,
    data?: Readonly<Record<string, unknown>>,
  ): void {
    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data === undefined ? {} : { data }),
    };
    this.writeEvent(event);
  }

  private writeEvent(event: LogEvent): void {
    if (this.format === "json") {
      this.output.write(`${JSON.stringify(event)}\n`);
    } else if (this.view !== undefined) {
      this.view.add(event);
    } else {
      const time = event.timestamp.slice(11, 19);
      const level = event.level.toUpperCase().padEnd(5);
      this.output.write(
        `${time} ${level} ${event.message}${compactData(event)}\n`,
      );
    }
  }
}

export const createLogger = (options?: LoggerOptions): Logger =>
  new Logger(options);
