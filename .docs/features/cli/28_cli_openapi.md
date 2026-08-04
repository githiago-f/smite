# 28. `@smitejs/openapi` package

## Goal

Stand up a new `@smitejs/openapi` package delivering the OpenAPI artifact
generator as a CLI plugin: `openapi(options)` traverses the compiled app's
routes via `@smitejs/http`, converts each `req` bucket's zod schema to JSON
Schema with zod v4's built-in `.toJSONSchema()`, and emits an OpenAPI 3.1
document to an output file. This is the "OpenAPI first" artifact from the
roadmap (`meta/15_final_verification.md`).

## Context

Prior art (`~/projects/smite/bundle.js`) generated OpenAPI from registered
descriptors using `zod-openapi`. This repo standardizes on **zod v4**, which
ships `.toJSONSchema()` on schema instances, so no third-party converter is
needed — and more importantly, `.toJSONSchema()` must be called on the
**user's live schema instances**, which only exist inside the user's executed
app bundle. Hence the generator is a plugin loaded from the user project via
`smite.config.ts` (slice 27), not code baked into `@smitejs/cli`.

The route traversal knowledge lives in `@smitejs/http` (a `routesOf(app)`
helper) so both the client generator and the OpenAPI generator share one
source of truth for "what routes does this app declare".

## Design

### `routesOf(app)` helper (in `@smitejs/http`)

`@smitejs/http` exports `routesOf(app: AppDescriptor)` returning:

```ts
readonly {
  req?: RouteInputConfig;                    // the route's zod schemas
  endpoints: readonly { method: string; path: string; pathParams: readonly string[] }[];
}[]
```

Implemented with the existing traversal in `serve.ts` style:
`childrenOf(app, "http.route")` → `childrenOf(route, "http.endpoint")`,
`pathParams` via the same extraction logic the client uses. This is the single
traversal both `@smitejs/client`'s emit and `@smitejs/openapi`'s emitter consume.

### `openapi(options)` plugin (in `@smitejs/openapi`)

```ts
openapi({ outfile, title?, version?, appName? }): SmitePlugin
```

`run({ app })`:

1. `routesOf(app)` to get routes + endpoints.
2. Skip `ANY` endpoints with a `console.warn` (mirrors the client generator).
3. For each endpoint, build the OAS operation:
   - `parameters` from `req.query` / `req.params` / `req.headers` zod schemas
     (each bucket → `z.toJSONSchema()` → its JSON properties become
     query/path/header parameters; non-object schemas are wrapped).
   - `requestBody` from `req.body` schema (JSON, `application/json`).
   - `responses`: a minimal default (200) until `route.output` lands.
4. Assemble an OpenAPI 3.1 document: `openapi: "3.1.0"`, `info.title`/
   `info.version`, `paths` keyed by path template with the method's operation.
5. Write `JSON.stringify(doc, null, 2)` to `outfile` (resolved from `cwd`).

### Wiring

- `packages/openapi/package.json` — deps `@smitejs/core`, `@smitejs/http`,
  `@smitejs/cli` (for the `SmitePlugin` type + `compileApp` in tests);
  `sideEffects: false`.
- Deps direction: `openapi → http/core/cli`; `@smitejs/openapi` is never
  imported by any lower package. No cycles.
- Root `tsconfig.build.json` + `vitest.config.ts` get `./packages/openapi`.

## Implementation steps

1. `packages/openapi/package.json` — name `@smitejs/openapi`, deps
   `@smitejs/core`, `@smitejs/http`, `@smitejs/cli`; `exports` (`.`); `sideEffects:
   false`; `files: ["dist", "!dist/**/*.test.*", "!dist/.tsbuildinfo"]`;
   `scripts: { build, test }`.
2. `packages/openapi/tsconfig.json` — `rootDir: src`, `outDir: dist`,
   `tsBuildInfoFile: dist/.tsbuildinfo`, excludes `*.test.ts`, `references`
   `../core`, `../http`, `../cli`.
3. Root `tsconfig.build.json` — add `{ "path": "./packages/openapi" }`.
4. `vitest.config.ts` — add `@smitejs/openapi` alias →
   `packages/openapi/src/index.ts`.
5. `@smitejs/http` — add `routesOf` to `src/serve.ts` (or a new
   `src/routes.ts`) and re-export from `src/index.ts`.
6. `src/openapi.ts` — the `openapi(options)` plugin factory + OAS assembly.
7. `src/index.ts` — barrel re-exporting `openapi`.
8. `src/index.test.ts` — fixture app → `compileApp` → `openapi().run` → assert
   emitted JSON (paths, methods, parameter names from `:id` templates, body
   schema); `ANY` skipped with a warning.
9. `src/docs.test.ts` — per-package docs-integrity harness.
10. `docs/index.md` — package landing (expanded with `route.output` later).
11. Fixture `packages/openapi/test/app.ts` (reuses the slice-27 http app shape).

## Edge cases & error handling

- **Empty app** (no routes) → document with an empty `paths` object (valid
  OpenAPI), not an error.
- **`ANY` endpoints** → skipped with `console.warn`, matching the client
  generator's behavior.
- **Missing `req` bucket** → that bucket contributes no parameters / no
  `requestBody`; no error.
- **Non-object bucket schema** → wrapped so `.toJSONSchema()` yields valid JSON
  Schema (array/string/primitives handled by zod v4).
- **Zod version skew** → `.toJSONSchema()` is called on the user's instance,
  so the emitter never imports its own zod; type-only `z` imports only.

## Verification

```bash
yarn build
yarn test        # openapi suite: emitted doc shape, ANY skip, no-registry run
yarn format && yarn biome check .
```

Definition of done:

- `openapi()` emits a valid OpenAPI 3.1 doc (paths, methods, params, body) for
  a multi-route fixture app, driven by `compileApp` through `smite.config.ts`.
- `@smitejs/openapi` adds zero new Biome violations and keeps
  `sideEffects: false`.
- The generated document contains no `globalRegistry` reference (it is
  artifact JSON).

## Dependencies / prerequisites

- Slice `27` (`@smitejs/cli` foundation: `compileApp`, plugin contract, config
  loader).
- `@smitejs/http` `serve`/traversal (slices `08`–`11`), zod v4 at root.

## Notes / open questions

- **`route.output` (response schemas)**: roadmap item #5 in `meta/15`. When it
  lands, the `responses` block becomes per-status-code with schema-derived
  content; the default 200 is a placeholder until then.
- **`servers` / `components`**: the emitted doc is minimal. Adding
  `servers` (env-provided base URL) and `components.schemas` (shared refs from
  `$defs`) are follow-ups.
- **Client emit parity**: `@smitejs/client` could later reuse `routesOf` too,
  folding the client's inline traversal into the shared helper; deferred to
  keep the client slice untouched.
