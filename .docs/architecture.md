# Architecture

## Vision

A compile-time-first, serverless application framework. Users write a
declarative TypeScript DSL (`@smite/http`), esbuild builds it, and the CLI
compiles the app in **collect mode**, executes it, and traverses
`globalThis.globalRegistry` to generate artifacts (OpenAPI first). Executors
run with **zero registry infrastructure** in the bundle.

## Layers

```
Application DSL (builders)          @smite/http: app, route, req, accept, handler
→ Semantic Registry (IR)            @smite/core: nodes + edges, global registry
→ Compiler / CLI                    @smite/cli: compile → execute → traverse
→ Artifact generators               OpenAPI, infra, docs        [future]
→ Runtime executors                 @smite/http: serve(); @smite/serverless [future]
```

## IR model

- **`Descriptor`** — a node: `{ __kind, __key, data }`, composite key
  (`"GET /users/:id"`). Frozen at creation; `data` is a frozen snapshot.
- **`RelationshipDescriptor`** — an edge: `{ from, to, relation }`, created by
  `relate`.
- **Edges at runtime** — `relate` attaches a non-enumerable child index
  (`Symbol.for("@smite/core/children")`) on the parent; `childrenOf` reads it.
  Executors walk these child refs.
- **Edges at build time** — `register` inserts every node/relationship into
  `globalThis.globalRegistry`, gated by `ALLOW_GLOBAL_REGISTRY`.
- **Junction** — `createApp(name?)` roots the graph (`kind: "app"`).
- **Lifecycle** — build with `defineDescriptor`/`relate`/`refine`, then
  `finalizeDescriptor(root)` deep-freezes the reachable subtree (cycle-safe).

## Packages

| Package           | Responsibility                    |
| ----------------- | --------------------------------- |
| `@smite/core`     | Registrar: nodes, edges, registry, compile-time flag, junction, freeze/refine |
| `@smite/http`     | HTTP DSL (`app`, `route`, `req`, `accept`, `handler`) + `serve()` executor |
| `@smite/fp`       | Functional primitives             |
| `@smite/domain`   | (stub) domain builders            |
| `@smite/serverless`| (stub) serverless adapters       |
| `@smite/cli`      | (stub) collect-mode compiler      |

Dependencies flow one way, no cycles: `fp`/`core` base → `http` →
`serverless`/`cli`. Packages import from the `@smite/*` public API only.

## Compile-time constants

`ALLOW_GLOBAL_REGISTRY` gates all collect-mode behavior. Guards reference the
raw identifier inline with the safe form
`typeof ALLOW_GLOBAL_REGISTRY === "boolean" && ALLOW_GLOBAL_REGISTRY` so an
undefined identifier never throws and esbuild folds the branch.

| Situation                | Result | Mode |
| ------------------------ | ------ | ---- |
| esbuild `define` → true  | `true` | collect (CLI) |
| esbuild `define` → false | `false`| runtime (users) |
| undefined                | `false`| runtime default |

`allowGlobalRegistry` is also exported from `@smite/core` for tooling.

## Tree-shaking

With `ALLOW_GLOBAL_REGISTRY: "false"` the registry module (`register`,
`lookup*`, `relationships`, `clear`) is unreachable and dropped. What survives:
descriptors, the child index, `childrenOf`, `finalizeDescriptor`, and the
executor. Proven by `packages/http/src/tree-shake.test.ts`.

## Validation

Zod-only. Per-bucket (`query`, `params`, `headers`, `body`) schemas declared in
`req({ ... })`; `serve` validates and rejects with a 400 on failure. Types are
inferred from the schemas into the handler context.
