# 27. `@smite/cli` foundation

## Goal

Stand up `@smite/cli` as the compile-time toolchain: a config-driven,
plugin-host CLI that compiles a user app in collect mode, executes it, finds
the app node in `globalThis.globalRegistry`, and runs generator **plugins**
contributed by packages installed in the user's project. Delivers the shared
`compileApp` engine (bundles, executes, locates the app), the `smite.config.ts`
loader, commander-based `smite <command>` dispatch, and the `client()`
generator plugin that turns `@smite/client`'s existing `generate()` into a CLI
command.

## Context

The roadmap (`meta/15_final_verification.md`) assigns `@smite/cli` the
`bundle.js` mechanism: bundle the user app with `ALLOW_GLOBAL_REGISTRY: "true"`,
execute, traverse the registry, and emit artifacts (OpenAPI first). The
compile→execute→traverse→emit pipeline already exists in
`@smite/client/generate()` (slice 17); this slice promotes its compile step
into a shared engine the CLI owns.

**Critical constraint: `@smite/cli` must not depend on `@smite/client` or
`@smite/http`.** A user may only install the packages they use. Generators that
serialize live zod schemas (OpenAPI today, zod-inferred client types tomorrow)
must call methods on schema instances that only exist inside the user's own
module graph — so generators ship in user-installed packages and are loaded
through the config file, never baked into the CLI.

The existing `packages/cli` stub (`src/index.ts` sketching `cli.use('command',
fn)`, empty `docs/index.md`, no `package.json`) is replaced by the real
skeleton. The `cli.use` idea is superseded by **config-listed plugins** (KISS:
no hidden global state, explicit and testable), but the plugin contract keeps
the same "packages contribute commands to the CLI" spirit.

## Design

### Dependency direction (the correction this slice enforces)

```
fp/core (base)
   ^
@smite/cli        deps: esbuild, commander, @smite/core
@smite/client     deps: core, esbuild, @smite/cli   (imports compileApp + plugin types)
@smite/http       deps: core, fp, zod, path-to-regexp
@smite/openapi    deps: http, core, @smite/cli       (slice 28)
```

- `@smite/cli` imports **no** `@smite/*` except `@smite/core`.
- `client → cli` and `openapi → cli` follow the architecture's allowed
  `→ serverless/cli` direction. No cycles.
- `@smite/client` keeps `@smite/client/runtime` isolated: the runtime never
  imports the CLI.

### `smite.config.ts` (composition root)

```ts
// smite.config.ts (user project)
import { defineSmiteConfig } from "@smite/cli";
import { client } from "@smite/client";     // from the user's node_modules
import { openapi } from "@smite/openapi";   // from the user's node_modules

export default defineSmiteConfig({
  entry: "./src/app.ts",
  plugins: [
    client({ outfile: "./src/app.client.ts" }),
    openapi({ outfile: "./openapi.json" }),
  ],
});
```

`defineSmiteConfig` is a type-only helper (and a runtime no-op returning its
argument) so the config's shape is checked without runtime cost. `alias` (a
`Record<string, string>`) is an optional field for monorepo development so the
entry bundle resolves `@smite/*` to source; in a user project esbuild resolves
from `node_modules` and `alias` is omitted.

### Plugin contract

```ts
interface SmitePlugin {
  name: string;
  run(ctx: { app: AppDescriptor }): void | Promise<void>;
}
```

Plugins are plain objects returned by factory functions (`client(options)`,
`openapi(options)`). `run` receives the app node and traverses the IR with
`childrenOf` for the kinds it knows; the CLI has no knowledge of `http.*` kinds.

### `compileApp` shared engine

`@smite/cli` exports `compileApp(options)`:

1. Resolve `entry` from `process.cwd()`.
2. esbuild-bundle into a temp dir: `platform: "node"`, `format: "cjs"`,
   `target: "es2022"`, `bundle: true`, `define: { ALLOW_GLOBAL_REGISTRY:
   "true" }`, `absWorkingDir: cwd`, optional `alias`.
3. `clear()` then dynamically import the bundle, populating
   `globalThis.globalRegistry`.
4. `lookupAll("app")`; error on none, disambiguate with `appName` on several.
5. Return the app node.

This is the exact pipeline currently in `@smite/client/generate()` (slice 17).
`@smite/client`'s `generate()` is refactored to call `compileApp` and keep its
emit step; public API and behavior are unchanged (existing client tests stay
green).

### CLI surface (commander)

`smite` binary:

- `smite generate <plugin> [--app-name <name>] [--config <path>]` — loads the
  config, runs `compileApp`, then dispatches to the matching `cfg.plugins`
  entry's `run({ app })`. `--config` defaults to `./smite.config.ts`.
- `smite list` — prints plugin names from the config.
- `smite --help` — commander's generated help.

`generate <plugin>` subcommands are registered dynamically from the loaded
config, so `smite generate client` works iff a `client()` plugin is listed.

### `client()` plugin factory (in `@smite/client`)

`@smite/client` exports a `client(options)` factory returning a `SmitePlugin`
whose `run` reuses the existing emit logic (build tree → collision-check →
emit). The standalone `generate()` and the plugin share the same emit module.

## Implementation steps

1. `packages/cli/package.json` — name `@smite/cli`, `bin: { smite:
   "./dist/cli.js" }`, deps `esbuild`, `commander`, `@smite/core`;
   `exports` (`.`), `sideEffects: false`, `files: ["dist", "!dist/**/*.test.*",
   "!dist/.tsbuildinfo"]`, `scripts: { build, test }`.
2. `packages/cli/tsconfig.json` — `rootDir: src`, `outDir: dist`,
   `tsBuildInfoFile: dist/.tsbuildinfo`, excludes `*.test.ts`, `references`
   `../core`.
3. Root `tsconfig.build.json` — add `{ "path": "./packages/cli" }` after
   `core`/`client`.
4. `vitest.config.ts` — add `@smite/cli` alias →
   `packages/cli/src/index.ts`.
5. `src/compile.ts` — `compileApp` (bundles, executes, locates app).
6. `src/config.ts` — `defineSmiteConfig` (type-only) + `loadConfig` (bundles
   `smite.config.ts`, imports, returns default export).
7. `src/plugins.ts` — `SmitePlugin` type + dispatch helper.
8. `src/cli.ts` — commander program wiring the above; shebang
   `#!/usr/bin/env node`.
9. `src/index.ts` — barrel re-exporting `compileApp`, `defineSmiteConfig`,
   `SmitePlugin`.
10. `src/index.test.ts` — compileApp finds an app; config loader picks up
    plugins; dispatch calls the right plugin; `generate client` end-to-end.
11. `src/docs.test.ts` — per-package docs-integrity harness (copied from
    `packages/{http,client,env}/src/docs.test.ts`, adjusted to `@smite/cli`).
12. `docs/index.md` — package landing (expanded in later slices).
13. `@smite/client` — add `@smite/cli` dep; refactor `generate()` to use
    `compileApp`; add `client()` factory + its test; keep existing tests green.
14. Fixture `packages/cli/test/app.ts` (a small http app) for the tests.

## Edge cases & error handling

- **Missing config** → error naming the expected path (`./smite.config.ts`).
- **Config not default-exporting** → error telling the author to `export
  default`.
- **Unknown plugin** (`smite generate nope`) → error listing available plugins.
- **No app / several apps** in the registry → same messages as
  `generate()` (slice 17): no app found, or pass `--app-name`.
- **Duplicate plugin names** → error on dispatch.
- **Temp-dir leak** → `compileApp` removes the temp dir after import (best
  effort; the import must stay alive during dispatch, so deletion happens in a
  `finally` after `run`).
- **Monorepo dev**: tests pass `alias` so the bundled app resolves
  `@smite/*` to `src`; the alias field is optional in user projects.

## Verification

```bash
yarn build
yarn test        # cli suite: compileApp, config loader, dispatch, generate client
yarn format && yarn biome check .
```

Definition of done:

- `smite generate client` emits a client for a fixture app via a `client()`
  plugin, driven by `compileApp` and `smite.config.ts`.
- `@smite/cli` imports no `@smite/client` / `@smite/http`.
- `@smite/client/generate()` still passes its slice-17 suite unchanged.
- `compileApp` is reusable by slice 28's `openapi()` plugin.

## Dependencies / prerequisites

- Slices `01`–`26` (IR, DSL, client codegen, env, functional DDD toolkit —
  `@smite/domain` is implemented and green).

## Notes / open questions

- **`cli.use` vs config plugins**: the stub sketched a global `cli.use`; this
  slice uses config-listed plugins instead (explicit, no hidden global state).
  A future `use()` sugar that appends to the config could be added without
  changing the contract.
- **`smite serve` / `smite dev`**: a `serve` command wrapping `@smite/http`
  `serve()` is a natural later slice; it would live behind the same plugin
  contract.
- **`@smite/serverless`**: `lambdaify` remains a stub; the CLI's `compileApp`
  is the shared entry point both adapters will build on.
