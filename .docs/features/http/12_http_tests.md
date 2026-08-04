# 12. HTTP Integration Tests

## Goal

Validate the `@smitejs/http` DSL end-to-end against the exact sketch in
`packages/http/src/index.ts` — declaration, IR wiring, inference, matching,
validation, and response normalization — all through the public API.

## Context

These are integration tests: they exercise the whole chain
(app → route → endpoint → handler → serve) rather than unit-testing internals.
The sketch's example becomes a compile-checked, runnable spec.

## Harness alignment

- **KISS** — one test file, plain assertions, no mocks; a real request object
  is just a plain literal.
- **DRY** — a `makeApp()` helper builds the fixture once; tests assert
  behaviors, not duplicated setup.
- **SOLID** — tests exercise the public surface (`@smitejs/http`), so internals
  (`validate.ts`, `matcher.ts`) can be refactored freely.
- **Clean** — the sketch example itself is a test (source of truth), avoiding
  drift between docs and behavior.

## Design

### File: `packages/http/src/index.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { afterEach } from "vitest";
import { childrenOf, clear } from "@smitejs/core";
import { z } from "zod";
import { HttpMethod, HttpStatus, http, json, status } from "./index.js";

afterEach(() => clear());

const makeApp = () => {
  const app = http.app();

  const route = http.route(app).req({
    query: z.object({ time: z.iso.date() }),
  });

  route.accept(HttpMethod.GET, "/:id").handler((ctx) =>
    status(200).json({ id: ctx.params.id, time: ctx.query.time }),
  );

  route.accept(HttpMethod.GET, "/").handler((ctx) =>
    json({ time: ctx.query.time }),
  );

  route.accept(HttpMethod.POST, "/").handler(async (ctx) => {
    const body = z.object({ name: z.string() }).parse(ctx.body);
    return status(HttpStatus.CREATED).json({ name: body.name });
  });

  return { app, serve: app.serve() };
};
```

### Contract checklist

**IR wiring**

1. `childrenOf(app.descriptor, "http.route")` has exactly 1 route.
2. `childrenOf(route, "http.endpoint")` has exactly 3 endpoints.
3. Each endpoint has exactly 1 handler child; `data.fn` is a function.
4. `Object.keys` of route/endpoint/handler exclude the child index.

**Type inference (compile-time)**

5. In `route.accept(HttpMethod.GET, "/")`, `ctx.query.time` is the inferred
   zod output (a compile error if `.time` is missing).
6. `ctx.params.id` is typed in the `/:id` handler.

**Dispatch**

7. `await serve({ method: "GET", path: "/users/42", query: { time: "2024-01-01" }, headers: {}, params: {}, body: undefined })`
   → `{ status: 200, body: { id: "42", time: "2024-01-01" } }`.
8. `GET /` returns `{ status: 200, body: { time: "2024-01-01" } }`.
9. `POST /` with a valid body returns `201` and the echoed body.
10. `POST /` with an invalid body returns `400` with zod issues.

**Validation & errors**

11. `GET /` with an invalid `time` (e.g. `"not-a-date"`) returns `400`.
12. `GET /unknown` returns `404`.
13. `DELETE /users/42` (path matches, method does not) returns `404`.

**Junction guard**

14. A second `http.app()` (unnamed) throws a duplicate-key error.

**Immutability**

15. After `serve()`, mutating a handler node or `route.data` throws (`TypeError`).

## Implementation steps

1. Create `packages/http/src/index.test.ts`.
2. Run `yarn test` — fp + core + http suites green.
3. Run `yarn check`.

## Edge cases & error handling

- **Zod v4 API**: `z.iso.date()` must exist; pin `zod@^4`. If the fixture
  compile fails on the exact schema, fall back to `z.string().datetime()` and
  note it (but the sketch's example is the contract — prefer `z.iso.date()`).
- **Request literals**: build a small `makeRequest(overrides)` helper to avoid
  repeating the full shape (DRY).
- **`clear()` after each test** is mandatory: the shared global registry
  otherwise leaks descriptors between tests.

## Verification

```bash
yarn test
```

Definition of done:

- The sketch's declaration compiles with inferred `ctx` types and every
  dispatch/validation/immutability assertion passes.

## Dependencies / prerequisites

- Slices `08`–`11` (full http DSL + serve executor).
- Slices `01`–`07` (core, registry, collect-mode tests).

## Notes / open questions

- These tests run in collect mode (registry populated). The runtime-mode
  contract (registry absent, executor works) is proven separately in
  slice `13_tree_shaking_bundle_test`.
- The POST handler in the fixture parses `body` again with zod — a realistic
  pattern once `req({ body })` is used; slice 09 supports declaring `body` in
  `req`, so a second fixture may use it instead (fewer manual parses).
