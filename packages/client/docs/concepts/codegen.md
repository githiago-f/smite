---
title: Generating a typed client
summary: Compiling your server into a TypeScript client at build time.
order: 10
---

`@smite/client` is the codegen engine: it builds your server entry, runs it once
at build time to discover the declared routes, and emits a TypeScript client
that mirrors them. It is the same engine the future CLI will drive, and it
produces fully typed code with no reflection at runtime.

## How it works

`generate({ entry, outfile })` does this:

1. Builds `entry` with esbuild (bundling the app and its dependencies).
2. Executes the bundle, which runs `http.app()` at module scope.
3. Reads the declared routes and endpoints.
4. Emits a builder-style client to `outfile` and returns the generated source.

@example Generate a typed client

## Options

- `entry` — the module that builds the app (must call `http.app()` at module
  scope).
- `outfile` — where the generated client is written.
- `appName` — disambiguates when a single build declares more than one app.
- `alias` — maps package names (`@smite/http`, `@smite/core`) to source paths
  so the build resolves local sources.

## Build-time, not runtime

Every route is known at compile time. The generated client imports only
`@smite/client/runtime` — a small fetch layer, nothing else — so it stays
small, tree-shakeable, and free of build-time machinery.