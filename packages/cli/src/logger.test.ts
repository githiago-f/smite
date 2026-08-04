import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";

const outputOf = (stream: PassThrough): string =>
  stream.read()?.toString() ?? "";

describe("@smite/cli logger", () => {
  it("writes newline-delimited JSON by default", () => {
    const output = new PassThrough();
    const logger = createLogger({ output });

    logger.info("generated application", { plugins: ["client"] });

    const event = JSON.parse(outputOf(output)) as {
      level: string;
      message: string;
      data: { plugins: string[] };
    };
    expect(event).toMatchObject({
      level: "info",
      message: "generated application",
      data: { plugins: ["client"] },
    });
    logger.close();
  });

  it("renders readable human output without a TTY", () => {
    const output = new PassThrough();
    const logger = createLogger({
      format: "human",
      output,
      interactive: false,
    });

    logger.warn("watcher restarted", { changed: 2 });

    expect(outputOf(output)).toMatch(
      /WARN\s+watcher restarted \{"changed":2\}/u,
    );
    logger.close();
  });

  it("normalizes structured child-process lines", () => {
    const output = new PassThrough();
    const logger = createLogger({ output });

    logger.fromLine(
      JSON.stringify({
        timestamp: "2026-08-04T12:00:00.000Z",
        level: "info",
        message: "server listening",
        data: { port: 3000 },
      }),
    );

    expect(JSON.parse(outputOf(output))).toMatchObject({
      message: "server listening",
      data: { port: 3000 },
    });
    logger.close();
  });
});
