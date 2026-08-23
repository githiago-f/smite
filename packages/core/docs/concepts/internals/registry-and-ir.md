---
title: Registry map and IR consumers
summary: Where state lives and what happens to the descriptor graph.
order: 60
---

A snapshot of the current architecture: every registry-shaped thing in the
repo, and the two lives of the generated IR (build-time collection, runtime
execution).

## Registries, mapped

- **Global descriptor registry** — `packages/core/src/registry.ts`. A single
  `Map` on `globalThis.globalRegistry` holding every node and edge created in
  collect mode, keyed by composite `__key` (duplicates throw). Written by
  `defineDescriptor` and `relate`; read by `lookup`/`lookupAll`/`relationships`
  and emptied by `clear`. It is the build-time window into the app.
- **Runtime child index** — `packages/core/src/descriptor.ts`. A non-enumerable
  `Map<relation, Descriptor[]>` attached to parent descriptors under
  `Symbol.for("@smitejs/core/children")`, walked with `childrenOf`. This is the
  graph that survives production builds and is what executors actually use.
- **Collect-mode flag** — `packages/core/src/constants.ts`. Registration is
  gated by the esbuild `define` `ALLOW_GLOBAL_REGISTRY`; folded to `false` in
  production so the registry code is dead-stripped.
- **CLI collection sessions** — `packages/cli/src/compile.ts`. Each entry is
  bundled with the flag on, the registry is cleared, the bundle executes, and
  `lookupAll()` snapshots the graph per entry. Runtime bundles then fold the
  flag off (`build.ts`).
- **Request-scoped context** — `packages/core/src/scope.ts`. An
  `AsyncLocalStorage` carrying per-request values (logger, tracer) through
  `runWithScope`/`currentScope`/`registerLogger`.
- **Provider config** — `packages/aws/src/context.ts`. A second
  `AsyncLocalStorage` (`runWithProviderConfig`/`getProviderConfig`) sharing
  deployment region/service with AWS client factories, falling back to env.
- **Symbol-keyed function metadata** — `Symbol.for` handles on functions:
  `@smitejs/fp/compositionMetadata` and `extractorMetadata`, and
  `@smitejs/domain/handler` (read by `http/src/endpoint.ts`) plus the domain
  `*DescriptorSymbol`s. They link runtime artifacts back to IR nodes across
  package boundaries and duplicated module instances, with no dependency.
- **Module-local registries** — duplicate-name detection and per-instance
  resolution caches in `@smitejs/env`, and plugin name dispatch in
  `@smitejs/cli`.

## What happens to the IR

### Build time: artifact generation

The CLI compiles entries, snapshots the registry, and hands the app nodes to
plugins, which traverse the graph via `childrenOf` (or entry-scoped descriptor
snapshots):

- **`@smitejs/client`** — `collectEndpoints` emits a typed builder client.
- **`@smitejs/openapi`** — `routesOf(app)` produces an OpenAPI 3.1 document
  and swagger UI.
- **`@smitejs/serverless` + `@smitejs/aws`** — `routesOf(app)` becomes HTTP API
  events; `aws.resource` and `aws.permission` nodes become CloudFormation
  resources and IAM statements in `serverless.yml`.
- **`http` `routesOf`** — the shared collected-route view reused by the above.
- **`env.var` nodes** — registered but not yet consumed; reserved for
  `.env.example` scaffolding and compile-time validation.
- **Domain cross-links** — collect mode adds a `handler -> domain.usecase`
  edge via the `@smitejs/domain/handler` symbol so generators see usecase
  metadata without a domain-to-http dependency.

The artifacts are generated source and configs; the IR itself is consumed and
discarded inside the compile process.

### Runtime: execution only

Production bundles fold the registry away. `serve(app)` deep-freezes the graph
(`finalizeDescriptor`) and builds matchers by walking the child index — never
the registry — reading the handler function off the `http.handler` node. Each
request runs inside a request scope. `serveNode` adapts the router to node:http.

## Lifecycle in one line

Build-time DSL calls register into the registry; plugins read it to emit
artifacts; the child index rides along on the descriptors so the folded
runtime can serve without any global state.
