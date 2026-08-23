# 13. Tree-Shaking Bundle Test (runtime mode)

## Goal

Prove the framework's central promise: when a user builds with esbuild and
defines `ALLOW_GLOBAL_REGISTRY: "false"`, the **registry and collect-mode code
disappear** from the bundle, while the executor and descriptors survive and
still work.

This is the runtime-mode contract that unit tests cannot verify (a global
`define` cannot be toggled per test file).

## Context

The requirement: *"our users will rely on esbuild to build their projects, and
our registry code and other pieces of code that are not important to the final
executor should be dropped or tree-shaken."*

The mechanism (from `~/projects/smite/bundle.js` and the
runtime/build-time separation skill): register into `globalThis` guarded by a
compile-time constant; esbuild `define` + constant folding removes the guarded
branches; the registry module, `register`, `lookup*`, and `relate`'s edge
registration become unreachable and are dropped.

## Harness alignment

- **KISS** — one esbuild call, one output-file assertion, one execution.
- **DRY** — the fixture is a small inline source (esbuild `stdin`); no
  fixture files pollute the repo.
- **SOLID** — the test asserts *observable bundle composition*, not internal
  implementation; refactors that preserve behavior pass.
- **Clean** — the test is the executable documentation of the
  runtime/build-time boundary.

## Design

### File: `packages/http/src/tree-shake.test.ts` (or root `test/`)

```ts
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as esbuild from "esbuild";

const source = `
  import { http } from "@smitejs/http";

  const app = http.app();
  const route = http.router(app).req({ query: { parse: (v) => v } });
  route.accept("GET", "/ping").handler((ctx) => ({ status: 200, body: "pong" }));
  export const router = app.serve();
`;

describe("runtime bundle", () => {
  it("drops the registry and still executes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "smite-"));
    const outfile = join(dir, "app.cjs");

    await esbuild.build({
      stdin: {
        contents: source,
        resolveDir: process.cwd(),
        sourcefile: "app.ts",
        loader: "ts",
      },
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "es2022",
      outfile,
      define: { ALLOW_GLOBAL_REGISTRY: "false" },
      alias: {
        "@smitejs/core": join(process.cwd(), "packages/core/src/index.ts"),
        "@smitejs/http": join(process.cwd(), "packages/http/src/index.ts"),
      },
    });

    const bundle = readFileSync(outfile, "utf8");

    // Registry and collect-mode code must be gone.
    expect(bundle).not.toContain("globalRegistry");

    // The executor must still work.
    const { router } = await import(outfile);
    const response = await router({
      method: "GET",
      path: "/ping",
      query: {},
      headers: {},
      params: {},
      body: undefined,
    });

    expect(response).toEqual({ status: 200, body: "pong" });
  });
});
```

### What the assertions mean

- `not.toContain("globalRegistry")` — the `Map`, `getRegistry`, and every
  guarded `register`/`relate` call are folded and dropped.
- The **execution** assertion is the real contract: descriptors (with the
  handler ref) and the child index survive, so `serve()` resolves and
  dispatches.

> **Child-index nuance**: the runtime *child refs* use the
> `Symbol.for("@smitejs/core/children")` symbol and the `relate` calls that wire
> the edges — they must survive. Only the *edge registration* (the guarded
> `register(...)` calls) and the registry module must disappear. That is why the
> test asserts the absence of `globalRegistry` plus observable behavior, and
> deliberately does **not** string-match `"relationship"` (the relationship
> nodes are part of the retained IR, not collect-mode code). Behavior is the
> contract; string-matching is a proxy.

### Why `alias` + `stdin`

- `alias` maps workspace names to their **source** entry, so the test bundles
  the code being developed (no stale `dist`).
- `stdin` keeps the fixture inline (DRY); `resolveDir` lets relative/package
  imports resolve from the repo root.
- `zod` / `path-to-regexp` resolve from `node_modules` as real dependencies —
  they are runtime deps and correctly remain in the bundle.

## Implementation steps

1. Create the test file (placement: `packages/http/src/tree-shake.test.ts`).
2. Run `yarn test` and confirm both assertions pass.
3. Run `yarn check`.

## Edge cases & error handling

- **Minification**: the test does *not* minify (only bundles), so string
  assertions are stable. Production users may add `minify: true` — the same
  folding holds (esbuild removes dead branches regardless).
- **CJS vs ESM**: `format: "cjs"` + `outfile` lets the test `import()` the
  result portably under Vitest; a pure-ESM variant would need a temp
  `package.json`. Keep CJS for simplicity.
- **Node external `globalThis`**: the bundled code must never reference
  `globalRegistry` (it does not, after folding). If it did, `node:platform`
  would silently resolve a missing global to `undefined` and `lookup` would
  return nothing — the execution assertion would fail loudly. Good.
- **Alias fragility**: if workspace package paths move, the test breaks with a
  clear resolve error. Acceptable for a repo-internal test.

## Verification

```bash
yarn test
```

Definition of done:

- A production-shaped bundle built with `ALLOW_GLOBAL_REGISTRY=false`:
  - contains no `globalRegistry`,
  - contains no relationship-edge registration,
  - serves `/ping` correctly via the retained executor.

## Dependencies / prerequisites

- `esbuild` devDependency (slice 01).
- Slices `02`–`11` (flag, registrar, full http DSL).

## Notes / open questions

- A **complementary collect-mode test** (bundle with `ALLOW_GLOBAL_REGISTRY:
  "true"`, execute, `Array.from(globalThis.globalRegistry.values())`, traverse)
  is the CLI's job and is explicitly deferred (scope decision). The mechanics
  are proven here; the CLI adds the artifact generation.
- Later, an esbuild **plugin** may encapsulate the `define` + `alias` wiring
  so users write `smite build` instead of raw esbuild flags. That belongs to
  the `@smitejs/cli` slice, not this one.
