# 07. Core Registrar Tests

## Goal

Lock the `@smite/core` registrar contract with a focused unit suite. The tests
cover nodes, edges, registry behavior, immutability, and error paths — nothing
about http yet (that is slice `12_http_tests`).

## Context

Testing philosophy (from the harness): **validate behavior, not
implementation details**. These tests exercise the public API surface
(`@smite/core`) exactly as a consumer or the CLI would. Because the Vitest
config aliases `@smite/core` to `src/index.ts`, no build is required to run
them.

## Harness alignment

- **KISS** — plain `describe`/`it`/`expect`; no test doubles, no mocks.
- **DRY** — shared fixtures via small helper builders in the test file.
- **SOLID** — each `describe` block targets one contract (nodes, edges,
  registry, lifecycle).
- **Clean** — `afterEach` clears the global registry so tests are isolated and
  order-independent.

## Design

### File: `packages/core/src/index.test.ts`

```ts
import { afterEach, describe, expect, it } from "vitest";
import {
  childrenOf,
  clear,
  createApp,
  defineDescriptor,
  finalizeDescriptor,
  lookup,
  lookupAll,
  refine,
  register,
  relate,
  relationships,
} from "./index.js";

afterEach(() => clear());

const route = (key = "GET /users/:id") =>
  defineDescriptor("http.route", key, { path: "/users/:id", method: "GET" });
```

### Contract checklist

**Nodes (`defineDescriptor`)**

1. Returns `{ __kind, __key, data }` with the exact inputs.
2. The returned node is frozen (`Object.isFrozen`).
3. Registers into the global registry (`lookup(key)` returns it).
4. Registering the same key twice throws with a message containing the key.
5. `lookup("missing")` is `undefined`; `lookupAll("http.route")` returns only
   route nodes.

**Edges (`relate` / `childrenOf`)**

6. `relate(app, "http.route", route)` returns a node with
   `__kind === "relationship"` and `data.relation === "http.route"`.
7. The edge key is composite: `"app->http.route->GET /users/:id"`.
8. The edge is present in `relationships()` (collect mode).
9. `childrenOf(app, "http.route")` returns `[route]`; `childrenOf(app)` returns
   it too.
10. The child index is non-enumerable: `Object.keys(route)` is exactly
    `["__kind", "__key", "data"]`.
11. `childrenOf(route)` (no edges) is `[]`.
12. Duplicate `relate(app, "http.route", route)` throws (composite key).

**Junction (`createApp`)**

13. `createApp("api")` → `__kind "app"`, `__key "api"`, `data.name "api"`.
14. `createApp()` → `__key "app"`.
15. A second `createApp()` throws (duplicate key) — documented guard.

**Lifecycle (`refine` / `finalizeDescriptor`)**

16. `refine(route, { summary: "x" })` keeps node identity
    (`lookup(key)` is the same object) and `data.summary` is set.
17. After `finalizeDescriptor(app)`, the app, its `data`, the route child, and
    the edge child index are all frozen.
18. `refine` after finalize throws (`TypeError`).
19. `finalizeDescriptor` terminates on a cyclic graph (self-edge).

**Registry isolation**

20. `clear()` empties the global; `lookupAll` returns `[]` afterwards.

## Implementation steps

1. Create `packages/core/src/index.test.ts` with the cases above.
2. Run `yarn test` — the whole suite (fp + core) must be green.
3. Run `yarn check` (Biome) on the new file.

## Edge cases & error handling

- **Test isolation**: the shared global registry means a leftover descriptor
  from one test pollutes the next; `afterEach(clear)` is mandatory, not
  optional.
- **Assertion helpers**: assertions on error messages should check a substring
  (the message contains the key), not the full string — resilient to wording
  changes (DRY/robustness).
- **Immutability assertions** rely on `Object.isFrozen`; keep them after
  `finalizeDescriptor` to prove the hardening.

## Verification

```bash
yarn test
```

Definition of done:

- All core registrar tests pass; `yarn check` clean; no tests depend on
  execution order.

## Dependencies / prerequisites

- Slices `02`–`06` (full `@smite/core` public API).
- `vitest.config.ts` alias + `ALLOW_GLOBAL_REGISTRY: "true"` define (slice 01).

## Notes / open questions

- These tests intentionally run in **collect mode**. A second matrix (runtime
  mode, `ALLOW_GLOBAL_REGISTRY=false`) is the esbuild bundle test in slice
  `13_tree_shaking_bundle_test` — unit tests cannot toggle a global define
  per-file, so the runtime contract is proven at the bundling level instead.
