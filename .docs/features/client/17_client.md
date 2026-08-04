# 17. Client Codegen (`@smitejs/client`)

## Goal

Generate a typed, builder-style HTTP client from a Smite app definition.
`generate()` bundles the app entry in collect mode, executes it, traverses
`globalThis.globalRegistry`, and emits a `.ts` module whose nested namespaces
mirror the routes. Callers never write `"GET /path"` — they call
`api.resource.$method(input)`.

```ts
const user = await api.users.$id.$get({ params: { id: "42" } });
// => Promise<{ status: number; body: unknown; headers: Record<string, string> }>
```

## Context

This establishes the compile → execute → traverse → emit pipeline the roadmap
assigns to `@smitejs/cli`; it lives here first so the CLI can wrap the same
engine later. The emitted artifact is runtime-only: it imports a small
`@smitejs/client/runtime` (fetch + serialization) and carries no registry code.

## Design

### Pipeline: `generate({ entry, outfile, alias?, appName? })`

1. **Bundle** `entry` with esbuild: `define: { ALLOW_GLOBAL_REGISTRY: "true" }`,
   `platform: "node"`, `format: "cjs"`. `alias` maps `@smitejs/*` to source when
   developing in the monorepo; in a user project the installed packages resolve
   from `node_modules`.
2. **Execute** the bundle, then `clear()` + traverse the registry: find the
   `app` node (`lookupAll("app")`, disambiguated by `appName`).
3. **Collect** endpoints: `childrenOf(app, "http.route")` →
   `childrenOf(route, "http.endpoint")` → `{ method, path, pathParams }`
   (params derived from the path template). `ANY` methods are skipped with a
   warning.
4. **Emit** a `.ts` module to `outfile`.

### Generated shape

Path segments become nested object keys; dynamic `:param` segments become
`$param` namespaces; each HTTP method becomes a `$method` leaf.

```ts
// src/app.client.ts (generated)
import { configure, request } from "@smitejs/client/runtime";
import type { ClientConfig } from "@smitejs/client/runtime";

export { configure };

export const api = {
  users: {
    $get: (input?: { query?: Readonly<Record<string, unknown>>; headers?: Readonly<Record<string, string>>; body?: unknown; $config?: ClientConfig }) =>
      request("GET", "/users", input),
    $post: (input?: { query?: ...; headers?: ...; body?: unknown; $config?: ClientConfig }) =>
      request("POST", "/users", input),
    $id: {
      $get: (input: { params: { id: string }; query?: ...; headers?: ...; body?: unknown; $config?: ClientConfig }) =>
        request("GET", "/users/:id", input),
    },
  },
};
```

Mapping rules:

- `/users` → `api.users`; `/users/:id` → `api.users.$id`; `/users/:id/posts`
  → `api.users.$id.posts`. Empty segments are dropped.
- `$method` = `"$" + method.toLowerCase()` (GET → `$get`).
- Params are typed structurally from the path template
  (`{ id: string }`) and are **required** when the path has dynamic segments.
- `query` / `headers` / `body` are loose optional buckets; `$config` is the
  per-call override for `configure({ baseUrl, fetch })`.
- Segments that are not valid identifiers are emitted as quoted keys.

### Runtime: `@smitejs/client/runtime`

- `configure({ baseUrl, fetch })` — module-level defaults (baseUrl, custom
  `fetch`).
- `request(method, template, input)` — interpolates params into the path,
  serializes `query` via `URLSearchParams`, sets `content-type:
  application/json` for object bodies, calls `fetch`, and returns
  `{ status, body, headers }` (body parsed as JSON when possible). Never
  throws on non-2xx — it mirrors the server `HttpResponse`.

### Types

Input buckets mirror the server's `req` config (params/query/headers/body).
The input type is structural (params from the template; query/headers as
records; body `unknown`). Emitting zod-inferred bucket types (schema → TS) and
response schemas are follow-ups. The generated module is runtime-safe: it
contains no `globalRegistry` reference.

## Implementation steps

1. `packages/client/package.json` — deps `@smitejs/core`, `esbuild`;
   `exports: { ".": generate, "./runtime": runtime }`;
   `sideEffects: false`.
2. `packages/client/tsconfig.json` — excludes `*.test.ts`, references
   `../core` (not `../http`: generated output and the runtime never touch
   `@smitejs/http`).
3. `src/generate.ts`, `src/runtime.ts`, `src/index.ts` (re-export `generate`),
   `src/index.test.ts`, `docs/index.md`.
4. Root: `tsconfig.build.json` reference; `vitest.config.ts` alias
   `@smitejs/client`.
5. Fixture `packages/client/test/app.ts` (a small http app) used by the tests.

## Edge cases & error handling

- **No app** in the registry → error. **Several apps** without `appName` →
  error asking for `appName`.
- **Collision** between a `$method` leaf and a nested namespace on the same
  node (e.g. a literal `$get` segment vs a GET method) → error.
- **Missing param** at request time → runtime error naming the param and path.
- **No `fetch`** available (neither global nor configured) → error telling the
  caller to `configure({ fetch })`.
- Non-JSON response bodies are returned as raw text.

## Verification

```bash
yarn test      # client suite: emitted structure, runtime serialization, generated-client execution
yarn build
yarn biome check .
```

Definition of done:

- `generate()` emits a builder client for a multi-route app.
- A generated client executes against a stubbed `fetch` and mirrors
  `{ status, body }`.
- The generated artifact contains no `globalRegistry`.
- The engine is reusable by the future `@smitejs/cli`.

## Dependencies / prerequisites

- Slices `01`–`13` (registrar, IR, tree-shaking rule), `16` (env optional).

## Notes / open questions

- **Zod-inferred bucket types** and response schemas (`route.output`) are the
  next step for full end-to-end typing.
- **Cookies/session** buckets: the input type is generic over buckets; adding
  `cookies`/`session` requires touching `@smitejs/http` + `serve` as well.
- The collect-mode `generate()` shares its traversal with `serve()` (child
  refs, not the registry) once the app node is located.
