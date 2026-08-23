# @smitejs/cli

The command-line workflow for Smite apps. Start with the
[`Getting started`](./concepts/getting-started.html) concept to create and run
an HTTP app, then use the sections below when you need generated clients,
OpenAPI, local reloads, or deployment builds.

The CLI compiles your app declarations and runs the generators contributed by
the packages you install (`@smitejs/client`, `@smitejs/openapi`, …). The CLI itself
does not choose or bundle those generators.

## First project

For a new project, install the CLI, HTTP DSL, and zod:

```bash
npm install -D @smitejs/cli @smitejs/http zod
npx smite create hello-api
cd hello-api
npm install
npm run dev
```

Then call the generated health route with `curl
http://127.0.0.1:3000/health`. The complete first-user walkthrough is in
[`Getting started`](./concepts/getting-started.html).

## Configure generators

Install the generators you need:

```bash
npm install -D @smitejs/client @smitejs/openapi
```

Declare a `smite.config.ts` at the project root. `entries` lists the app entry
points to compile in collect mode — use one entry per serverless handler
(Lambda, GCP function, …), and `entry` is shorthand for a single entry:

```ts
import { defineSmiteConfig } from "@smitejs/cli";
import { client } from "@smitejs/client";
import { openapi } from "@smitejs/openapi";

export default defineSmiteConfig({
  entries: ["./src/app.ts"],
  plugins: [
    client({ outfile: "./src/app.client.ts" }),
    openapi({ outfile: "./openapi.json" }),
  ],
});
```

For a serverless app with several handler entries:

```ts
export default defineSmiteConfig({
  entries: ["./src/handlers/api.ts", "./src/handlers/events.ts"],
  plugins: [client({ outfile: "./src/app.client.ts" })],
});
```

Each entry compiles in its own registry session and the generator sees the
union of apps (deduplicated by app name), so one client/OpenAPI artifact covers
every handler.

Run generators from the project root:

```bash
smite generate client
smite generate openapi
npx smite generate client
npx smite generate openapi
npx smite list
```

CLI output is human-readable by default. Commands print the result or next
action directly, so `smite create`, `smite build`, and `smite dev` are suitable
for interactive terminal use without extra flags.

## Build for deployment

`npx smite build` runs every generator plugin, then bundles runtime entries with
`ALLOW_GLOBAL_REGISTRY` folded to `false`:

```ts
export default defineSmiteConfig({
  entry: "./src/app.ts",
  plugins: [client({ outfile: "./src/app.client.ts" })],
  build: {
    entry: "./src/server.ts",
    outdir: "./dist",
  },
});
```

```bash
smite build
```

Use `build.entries` for several runtime bundles. If `build.entry` /
`build.entries` is omitted, `smite build` bundles the app `entry` / `entries`
directly.

## Run local commands

`cli.exe("name", handler)` registers a local command from a source entry. Run
it with `smite run <name>`: the entry is compiled in collect mode, the
registration is collected, and the handler runs with the compiled app and
provider nodes available by closure. This is the hook for local pipelines that
generate artifacts (`@smitejs/client`, `@smitejs/openapi`) and upload them to a
bucket declared with `@smitejs/aws`:

```ts
// src/cli.ts
import { cli } from "@smitejs/cli";
import { generate } from "@smitejs/client";
import { provider } from "@smitejs/aws";

cli.exe("publish:client", async () => {
  const code = await generate({ entry: "./src/app.ts", outfile: "dist/client.ts" });
  console.log(code.length);
});
```

```ts
// smite.config.ts
export default defineSmiteConfig({
  entry: "./src/app.ts",
  cliEntries: ["./src/cli.ts"], // commands never become runtime entries
  plugins: [],
});
```

```bash
npx smite run publish:client
```

`cliEntries` defaults to the app `entries`; set it to a dedicated command entry
so serverless functions are not derived from it. Commands are plain functions,
so the same handler can be imported and called from any script.

## Develop locally

`smite dev` runs the local-development loop for a single app:

```bash
smite dev            # generators + local server + auto-reload
smite dev --port 4000
```

It compiles the app entries in collect mode, runs every plugin in
`smite.config.ts`, bundles a runtime server over `node:http` (via
`@smitejs/http`'s `serveNode`) with esbuild, and spawns it. The CLI never
imports `@smitejs/http` — the generated entry resolves it from your installed
packages at bundle time. On change, the sources are watched (generated
`*.client.ts` / `openapi.json` excluded), and it re-runs the generators,
rebundles, and restarts the server. Pass `--no-watch` to serve once.

## Scaffold a new app

`smite create <name>` writes a complete TypeScript starter project into
`./<name>`: a `package.json`, a `tsconfig.json`, a `smite.config.ts` declaring
the `client()` and `openapi()` plugins, a runnable `src/app.ts` + `src/server.ts`
(built on `serveNode` with Swagger UI), a README, and a `.gitignore`:

```bash
smite create my-app
cd my-app
npm install
npm run dev        # generators + local server + auto-reload
npm run start      # production server (node src/server.ts) with Swagger at /docs
npm run typecheck  # tsc --noEmit
```

Pass `--template <name>` to choose a starter (`default` or `minimal`) and
`--force` to overwrite an existing directory. The same scaffolding is
available as `yarn create smite-app` via the `create-smite-app` package.

## How it works

- **`compileApp`** bundles `entry` with `ALLOW_GLOBAL_REGISTRY: "true"`,
  executes it in-process, and locates the `app` node in
  `globalThis.globalRegistry`. Because the registry lives on `globalThis` and
  the child index uses `Symbol.for`, this package's own `@smitejs/core` copy can
  traverse descriptors created by the bundled app.
- **Plugins** are plain `{ name, run }` objects from your installed packages.
  The CLI has no knowledge of `http.*` or `domain.*` kinds — plugins traverse
  the IR themselves via `childrenOf`.
- **`smite generate <plugin>`** loads the config, compiles every entry, and
  dispatches to the matching plugin's `run({ apps })` with the union of apps.
- **`smite build`** loads the config, compiles every app entry, runs every
  plugin, and bundles runtime entries with descriptor collection disabled.

## API

- `compileApp({ entry, appName?, alias? })` — bundle + execute + locate one
  app.
- `compileApps({ entries, alias? })` — bundle + execute each entry and return
  the deduplicated union of apps.
- `entriesOf(config)` — resolve `entries` (or the `entry` shorthand) from a
  config.
- `cliEntriesOf(config)` — resolve `cliEntries`, falling back to app entries.
- `buildEntriesOf(config)` — resolve `build.entries` / `build.entry`, falling
  back to app entries.
- `build(options)` — run generators, then bundle runtime entries for
  deployment.
- `bundleBuildEntries({ cwd, entries, outdir?, alias?, sourcemap?, minify?,
  target? })` — bundle runtime entries with the registry disabled.
- `createApp({ name, baseDir?, template?, force? })` — scaffold a starter
  project into `<baseDir>/<name>` and return the created directory.
- `listTemplates()` — list the available starter templates.
- `defineSmiteConfig(config)` — type-only config helper (no-op at runtime).
- `loadConfig(path?, alias?)` — bundle and read `smite.config.ts`'s default
  export.
- `dispatch(plugins, name, { app })` — run the named plugin, erroring on
  unknown or duplicate names.
- `runAll(plugins, { apps })` — run every plugin in declaration order (used by
  `smite dev`).
- `cli.exe(name, handler)` — register a local command callable with
  `smite run <name>`.
- `collectCommands(compiledEntries)` — collect registered `cli.command`
  descriptors, erroring on duplicates.
- `runCommand(commands, name, ctx)` — run the named command, erroring on
  unknown or duplicate names.
- `dev(options)` — run the local-development loop (generators → server →
  auto-reload).
- `bundleDevServer({ cwd, entry, alias?, docs?, title?, outfile })` — bundle
  a runtime dev-server entry with esbuild.
- `spawnServer(outfile, { cwd, port, host, stdio? })` — spawn the bundled dev
  server as a child `node` process.
- `collectWatchedFiles({ cwd, configPath, entries })` — the source files
  `smite dev` watches, excluding generated artifacts.
- `DevWatcher` — fingerprint-polling file watcher (no native deps).

`alias` maps `@smitejs/*` to source paths when developing in the monorepo; in a
user project esbuild resolves them from `node_modules` and it is omitted.
