import { describe, expect, it } from "vitest";
import { currentScope, registerLogger, runWithScope } from "./index.js";
import type { ScopeContext } from "./scope.js";

describe("scope", () => {
  it("propagates context across awaited boundaries", async () => {
    // #section - Scope a request handler
    const context: ScopeContext = { method: "GET", path: "/health" };
    const observed = await runWithScope(context, async () => {
      await Promise.resolve();
      return currentScope();
    });
    // #endsection

    expect(observed).toBe(context);
  });

  it("returns undefined outside an active scope", () => {
    expect(currentScope()).toBeUndefined();
  });

  it("restores the enclosing scope after an inner scope resolves", async () => {
    const outer: ScopeContext = { request: "outer" };
    const inner: ScopeContext = { request: "inner" };

    const seenInner = await runWithScope(outer, () =>
      runWithScope(inner, async () => {
        await Promise.resolve();
        return currentScope()?.request;
      }),
    );
    await runWithScope(outer, async () => {
      await runWithScope(inner, () => Promise.resolve());
      expect(currentScope()?.request).toBe("outer");
    });

    expect(seenInner).toBe("inner");
  });
});

describe("documentation examples", () => {
  it("registers a request-scoped logger", () => {
    // #section - Register a request-scoped logger
    const named = runWithScope({ id: "req-1" }, () =>
      registerLogger((context) => `logger-${context?.id}`),
    );
    // #endsection

    expect(named).toBe("logger-req-1");
  });
});
