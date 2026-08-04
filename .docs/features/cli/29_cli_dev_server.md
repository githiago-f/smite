# 29. `smite dev`: local node:http server with auto-reload

## Goal

Add `smite dev` to `@smitejs/cli`: a local-development loop that runs the
generators, bundles the app into a self-contained `node:http` server, serves
it, and auto-reloads on change (re-run generators → rebundle with esbuild →
restart). In the same slice, `@smitejs/http` ships the shared `serveNode`
adapter (the "internal server helper" the CLI and scaffolded `server.ts` both
use, extensible by users), and the scaffolder templates move to
**always-TypeScript** sources.

## Context

Slice 27 flagged `smite serve` / `smite dev` as a "natural later slice" behind
the plugin contract. Today a scaffolded app is `.mjs` and hand-wires a
`node:http` server + Swagger UI in `src/server.mjs`; there is no watch loop and
no CLI command that runs the local server.

**Critical constraint (carried over from slice 27): `@smitejs/cli` must not
depend on `@smitejs/http` or `@smitejs/client`.** The dev server therefore never
imports those packages in the CLI process. Instead `smite dev`:

1. compiles entries in collect mode with the existing `compileApps` (this is
   the esbuild "rebundle" step),
2. runs every plugin in `smite.config.ts` via a new `runAll` helper,
3. generates a tiny server entry that `import`s the user's app and
   `@smitejs/http`'s `serveNode`, bundles it in **runtime mode**
   (`ALLOW_GLOBAL_REGISTRY: "false"`), resolving `@smitejs/http` from the
   user's installed packages, and spawns it as a child `node` process.

## Design

### `serveNode` adapter (in `@smitejs/http`)

`packages/http/src/node-server.ts`:

```ts
serveNode(app, options?): http.Server   // not yet listening
```

- Parses `IncomingMessage` → `HttpRequest`: URL/query, headers, cookies, and a
  JSON body for `POST`/`PUT`/`PATCH`.
- Dispatches through `serve(app)`, then writes the `HttpResponse` (content
  type, stringified body).
- `options.docs?: { router, paths }` — routers mounted at exact paths ahead of
  the app's routes (e.g. `swaggerUi({ doc, title })` at `["/docs",
  "/openapi.json"]`).
- `options.transformRequest?: (req, parsed) => Partial<HttpRequest>` — the
  user extensibility seam.
- Returns the `Server` unlistened so callers compose `.listen(port, host, cb)`.

The returned server handles each request with an internal `try/catch` that
maps failures to a `500` JSON response.

### `smite dev` loop (in `@smitejs/cli`)

`packages/cli/src/dev.ts` exports:

- `runAll(plugins, ctx)` (in `plugins.ts`) — run every plugin in declaration
  order ("system runs generators").
- `bundleDevServer({ cwd, entry, alias?, docs?, title?, outfile })` — builds
  a generated entry via esbuild `stdin` and writes the runtime bundle:
  `platform: node`, `format: esm`, `target: es2022`, `define: {
  ALLOW_GLOBAL_REGISTRY: "false" }`. The entry does `import { serveNode } from
  "@smitejs/http"`, imports the user's `app` (`mod.app ?? mod["default"]`), and
  optionally mounts `swaggerUi` when `docs` is on. Output defaults to
  `node_modules/.smite/dev-server.mjs`.
- `spawnServer(outfile, { cwd, port, host, stdio? })` — spawns the bundle as a
  child `node` process with `PORT`/`HOST` in its env; `stdio` defaults to
  `"inherit"`.
- `collectWatchedFiles({ cwd, configPath, entries })` — the config plus every
  `.ts`/`.mjs`/`.json` under each entry's directory, **excluding** generated
  artifacts (`*.client.ts`, `openapi.json`) and `node_modules`/`dist`/`.git`
  so regeneration never re-triggers a rebuild.
- `DevWatcher` — a dependency-free fingerprint poller
  (`mtimeMs` + `size` on an interval, first poll seeds the baseline), the same
  technique `scripts/dev-docs.mjs` uses. Recursive `fs.watch` is not portable
  (Linux), so polling is the portable choice.
- `dev(options)` — the orchestrator:

```
loadConfig → compileApps → runAll → bundleDevServer → spawnServer
                                     └─ watch: on change →
                                        (reload config if smite.config.ts changed)
                                        → compileApps → runAll → rebundle → restart
```

  On rebuild, build errors are logged but the last good server keeps running
  (the child is only replaced after a successful rebundle). SIGINT/SIGTERM
  (or an `AbortSignal` passed for tests) kills the child and resolves.

`smite dev` flags: `--config <path>`, `--port <number>`, `--host <host>`,
`--no-watch`.

### Scaffolder: always TypeScript

`packages/cli/src/create.ts` templates now write:

- `src/app.ts` (was `app.mjs`) — same routes, now TypeScript.
- `src/server.ts` (was `server.mjs`) — a thin, extensible wrapper:

```ts
import { serveNode } from "@smitejs/http";
import { swaggerUi } from "@smitejs/openapi";
import { app } from "./app.ts";

const doc = JSON.parse(await readFile(new URL("../openapi.json", import.meta.url), "utf8"));
const server = serveNode(app, {
  docs: { router: swaggerUi({ doc, title: "…" }), paths: ["/docs", "/openapi.json"] },
});
server.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? "127.0.0.1", () => { … });
```

- `tsconfig.json` — `NodeNext`, `strict`, `verbatimModuleSyntax`,
  `allowImportingTsExtensions` + `noEmit`, `types: ["node"]`.
- `package.json` scripts: `generate`, `dev` (`smite dev`), `start` (`node
  src/server.ts`), `typecheck` (`tsc --noEmit`); devDep `typescript`.
- `smite.config.ts` entries point at `./src/app.ts`.

`node src/server.ts` runs directly on Node 24+ type stripping (`.ts`
extensions in relative imports are required and already present), so `start`
needs no build step.

## Implementation steps

1. `@smitejs/http` — add `src/node-server.ts` (`serveNode`), export from
   `index.ts`, add `@types/node` devDep; tests in `node-server.test.ts`
   (routes over real sockets, cookies/query/body, docs mount,
   `transformRequest`) plus a `#section` example; concept doc
   `docs/concepts/node-server.md`.
2. `@smitejs/cli` — `plugins.ts` gains `runAll`; new `dev.ts` (`dev`,
   `bundleDevServer`, `spawnServer`, `collectWatchedFiles`, `DevWatcher`);
   register `smite dev` in `cli.ts`; export from `index.ts`.
3. `@smitejs/cli` tests — `dev.test.ts`: `runAll` ordering, bundling a runtime
   server without `globalRegistry`, spawning the bundle and answering HTTP
   requests, watched-file collection excluding generated files, `DevWatcher`
   change detection.
4. `@smitejs/cli` scaffolder — swap templates to `.ts`, add `tsconfig.json`,
   `dev`/`typecheck` scripts, README updates; update `cli.ts` + `create-app`
   next-steps and the `.mjs`-referencing tests.
5. Docs — this file, AGENTS.md, `packages/cli/docs/index.md` (dev workflow +
   new API), `packages/http/docs/concepts/node-server.md`.

## Edge cases & error handling

- **Port in use** — the child exits; its stderr is inherited, so the failure
  is visible while the watcher keeps running.
- **Build/generate errors on change** — logged; the previous server stays up.
- **Generated-file loops** — `*.client.ts` and `openapi.json` are excluded
  from the watched set.
- **Config change** — `smite.config.ts` changes trigger a config reload before
  the rebuild, so plugins can be added/removed while dev runs.
- **`@smitejs/openapi` absent** — `dev` probes resolution from the project
  (`createRequire`) and omits the Swagger imports; docs endpoints are skipped.
- **Multiple entries** — the dev server serves the first entry's exported
  `app`; generators still compile the union of all apps.
- **Entry without `app`/`default` export** — the child fails fast with an
  import error, surfaced through inherited stderr.

## Verification

```bash
yarn build
yarn test        # http serveNode suite + cli dev suite + scaffold e2e
yarn docs:build  # new @example snippets resolve to tested #section snippets
yarn format && yarn biome check .
```

Manual smoke: `smite create demo-app && cd demo-app && npm install && npm run
dev`, edit a route in `src/app.ts`, and observe the regenerated
`src/app.client.ts`/`openapi.json` plus a server restart.

## Dependencies / prerequisites

- Slices 01–28 (IR, DSL, serve executor, config/plugin CLI foundation).

## Notes / open questions

- Resolves slice 27's "`smite serve` / `smite dev`" open note: `smite dev`
  with `--no-watch` is effectively the single-shot `serve` command.
- **`smite build`**: bundling `src/server.ts` to a `dist/` artifact for
  deployment is a natural follow-up slice; today `npm start` runs the
  TypeScript file directly under Node 24+ type stripping.
- **Multi-app dev**: serving more than the first entry (e.g. mounting each
  app's router) can be added later without changing the plugin contract.
