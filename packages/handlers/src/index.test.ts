import { describe, expect, it } from "vitest";
import { emptyHandler, fire, handlers, metadataOf } from "./index.js";
import type { EmptyHandler } from "./index.js";

describe("zero-input handlers", () => {
  it("handles zero-input events with only a signal", async () => {
    // #section - Handle zero-input events
    const onTicker: EmptyHandler<number> = ({ name, at }) => {
      const clock = new Date(at);
      return `${name}@${clock.getMinutes()}:${clock.getSeconds()}`.length;
    };

    const length = await onTicker(
      fire("ticker", new Date("2026-01-01T00:00:00Z")),
    );
    // #endsection

    expect(length).toBeGreaterThan(0);
    expect(fire("ticker").name).toBe("ticker");
  });

  it("defines a zero-input handler with metadata", () => {
    // #section - Define a zero-input handler
    const onStart = emptyHandler({ name: "scheduler:start" }, () => undefined);
    // #endsection

    expect(metadataOf(onStart)).toEqual({ name: "scheduler:start" });
  });

  it("reads zero-input handler metadata", () => {
    // #section - Read zero-input handler metadata
    const onClose = emptyHandler({ name: "realtime:close" }, () => undefined);
    const meta = metadataOf(onClose);
    // #endsection

    expect(meta?.name).toBe("realtime:close");
    expect(metadataOf(() => undefined)).toBeUndefined();
  });

  it("fires a zero-input handler signal", () => {
    // #section - Fire a zero-input handler
    const at = new Date("2026-01-02T03:04:05Z");
    const signal = fire("nightly", at);
    // #endsection

    expect(signal).toEqual({
      name: "nightly",
      at: Date.UTC(2026, 0, 2, 3, 4, 5),
    });
    expect(Object.isFrozen(signal)).toBe(true);
  });

  it("keeps metadata non-enumerable", () => {
    const onRun = emptyHandler({ name: "jobs:run" }, () => undefined);
    expect(Object.keys(onRun)).toEqual([]);
    expect(Object.keys(handlers).sort()).toEqual([
      "emptyHandler",
      "fire",
      "metadataOf",
    ]);
  });
});
