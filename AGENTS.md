# AGENTS.md

Smite is a compile-time-first, serverless application framework. The branch is
`rework`. This file keeps you from fighting stale config or re-deriving the
architecture.

## State of the repo (verify before trusting)

- **The plan of record is `.docs/features/{package}/{NN}_*.md`** (ordered
  slices, grouped by package: `core` 01–07, `http` 08–13, `meta` 14/15/18/19,
  `env` 16, `client` 17, `domain` 20–26, `cli` 27–29). Slices **01–29 are
  implemented**: `@smitejs/core` (registrar), `@smitejs/http` (DSL + executor +
  `serveNode` node:http adapter), `@smitejs/env` (declarative env vars),
  `@smitejs/client` (build-time typed-client codegen), `@smitejs/domain`
  (functional DDD toolkit), `@smitejs/cli` (config-driven plugin-host compiler:
  `compileApp`, `smite.config.ts`, `smite` bin, `smite dev` auto-reload local
  server), `@smitejs/openapi` (OpenAPI 3.1 generator plugin) and `create-smite-app`
  (scaffolder: `yarn create smite-app`, always-TypeScript templates) are green,
  18/19 close the
  docs flow (tested `#section` snippets → `@example` JSDoc → injected `dist`
  declarations → static site, Internals taxonomy). The next work is the
  roadmap (serverless, `smite build`, zod-inferred client buckets) documented
  at the end of `client/17_client.md`.
- **Examples and benchmarks live outside the packages**: `examples/*`
  (runnable apps, also yarn workspaces: `http-rest-server`, `env-http`,
  `typed-client`, `fp-utils`) and `benchmarks/` (docker + k6 routing
  benchmark vs Express/Fastify, `yarn bench:http`). Examples are `.mjs`, so
  Biome lints them too; keep them clean and runnable (`yarn workspace
  @smitejs/example-* start`).
- **Docs integrity is enforced per package**: every `packages/{core,http,env,client,fp}/src/docs.test.ts`
  asserts each `@example` in `src/**/*.ts` resolves to a tested `#section`
  snippet and renders as a ```ts fence. Keep `docs.test.ts` in sync when
  adding or renaming examples.
- **Concept docs must never contain raw ` ```ts ` fences** — the site renderer
  escapes them into plain text. Every code example in `packages/*/docs/concepts/*.md`
  must be an `@example <Title>` line backed by a tested `#section` snippet in
  that package's `src/*.test.ts`. `yarn docs:build` throws on a raw fence, so
  this is enforced at build time. Shell commands in concept docs go in inline
  backticks, not fences.
- Root `package.json` and `tsconfig.build.json` reference the live workspaces
  (`fp`, `core`, `http`, `env`, `client`). Package build tsconfigs **exclude
  `*.test.ts`** (tests are run by Vitest, not `tsc`).
- `node_modules` is installed (Yarn 1.x classic; Node 24, `.nvmrc` =
  `lts/krypton`).
- `~/projects/smite` is prior-art lineage, not authoritative. Its `bundle.js`
  documents the intended CLI flow (compile with `ALLOW_GLOBAL_REGISTRY: "true"`,
  execute, traverse `globalThis.globalRegistry`).
- **Known pre-existing Biome violations** (not from slices 16/17):
  `packages/core/src/registry.ts` (`noAssignInExpressions`),
  `packages/fp/src/index.ts` (`noArguments`), and
  `packages/serverless/src/index.d.ts` (`noExplicitAny` ×3). The 6 redundant
  `import type` in `packages/http/src/index.ts` (the old `noUnusedImports`
  set) were removed by `biome check --write` during the extractor slice.
  `yarn check` reports these; leave them unless asked.

## Commands

- `yarn install` — Yarn 1.x classic.
- `yarn test` — Vitest, all workspaces (fp, core, http incl. the tree-shake bundle test).
- `yarn build` — `tsc -b tsconfig.build.json` (`fp`, `core`, `http`, `env`, `client`).
- `yarn check` — Biome (`check`/`format`, indent 2 spaces). Run `yarn format` before `yarn check`.
  Note: `yarn check` is also Yarn's built-in integrity check — run `yarn biome check .`
  to actually run Biome.
- Run a single package: `yarn workspace @smitejs/<name> test` or `yarn vitest run packages/<name>`.
- `yarn docs:build` — static docs site generator (`scripts/build-docs.mjs`) into
  `dist/docs/`: reads package JSDoc from `src/**/*.ts` (`@group`/`@intent`/
  `@example <Title>`), renders each package as an overview page
  (`packages/smite-*/index.html`) plus a reference page grouped by intent
  (`reference.html`) with shiki/Catppuccin syntax highlighting and Code/Result
  tabs. Every `@example` resolves to a tested `#section` snippet (missing
  snippets throw). Concept docs come from `packages/*/docs/concepts/*.md`
  (frontmatter `order`/`title`/`summary`, inline `@example`/`@benchmark`).
  Concept files under a `concepts/internals/` subfolder render under an
  "Internals" group in the sidebar/overview instead of "Concepts" — use it for
  the framework's own internals (e.g. `@smitejs/core`'s descriptor IR); user
  workflow concepts stay directly in `concepts/`. Benchmarks render from
  `benchmarks/results/*.summary.json` when present.
  Requires `shiki`, `@shikijs/themes`, and `jsdoc` dev deps.
- `yarn bench:http` — routing benchmark (`benchmarks/run.mjs`): builds three
  Docker containers (smite bundled with `ALLOW_GLOBAL_REGISTRY` folded out,
  Express, Fastify) that serve the identical four routes, runs k6 against each,
  and writes `benchmarks/results/{smite,express,fastify}.summary.json`.
  `benchmarks/results/` is gitignored. The docs renderer (build-docs.mjs) reads
  `@benchmark` directives against those files and shows the current numbers.
- `yarn bench:clean` — removes `benchmarks/results/`.
- `yarn docs:dev` — localhost server (`127.0.0.1:4173`) serving `dist/docs` with
  rebuild-on-change (`scripts/dev-docs.mjs`).
- `yarn docs:inject` — injects tested `#section` snippets into the emitted
  `dist` declarations (`scripts/inject-jsdoc-examples.mjs`). Requires `yarn
  build` first so `dist` is fresh.

## Architecture invariants (from the feature docs — do not break)

- IR = `Descriptor` nodes + `RelationshipDescriptor` edges, registered into the
  **global** registry (`globalThis.globalRegistry`), composite keys.
- **Build-time vs runtime is the core rule.** Registration/collection is
  guarded by the compile-time constant `ALLOW_GLOBAL_REGISTRY` (esbuild
  `define`, folded to `false` in production). Executors (`serve`, adapters)
  must never import the registry; they walk the IR via child refs.
- **Guards must reference the raw `ALLOW_GLOBAL_REGISTRY` identifier inline**
  (`typeof ALLOW_GLOBAL_REGISTRY === "boolean" && ALLOW_GLOBAL_REGISTRY`).
  esbuild `define` substitutes only the literal identifier — an imported const
  (`allowGlobalRegistry`) cannot be folded and would keep the registry in
  production bundles. This is enforced by `packages/http/src/tree-shake.test.ts`.
- Tests run in **collect mode** (Vitest `define: ALLOW_GLOBAL_REGISTRY: "true"`);
  runtime mode is proven by an esbuild bundle test (`define: "false"`).
- Every package must set `sideEffects: false`. Prefer `const` objects over TS
  `enum` (enums can't be tree-shaken by esbuild).
- Validation is **zod-only**.
- Dependency direction (one-way, no cycles): `fp`/`core` base →
  `http`/`env` → `client` → `serverless`/`cli`, and `openapi` →
  `http`/`core`/`cli`. Packages import from the `@smitejs/*` public API only,
  never each other's internals. `@smitejs/cli` imports **no** `@smitejs/*` beyond
  `@smitejs/core`; `@smitejs/client` depends on `@smitejs/core` + `@smitejs/cli` (not
  `@smitejs/http`); `@smitejs/client/runtime` never references the registry or
  `@smitejs/http`.

## TypeScript conventions (configured, easy to violate)

- `moduleResolution: NodeNext` → relative imports need the explicit `.js`
  extension (`import { x } from "./descriptor.js"`).
- `verbatimModuleSyntax` → type-only imports must use `import type`.
- `exactOptionalPropertyTypes` → omit optional props via spread; never assign
  `undefined`.
- Don't add comments unless asked.

## Gotchas

- `packages/fp/package.json` has a self-dependency (`"@smitejs/fp"`); slice 01
  removes it — don't copy the pattern into new packages.
- Keep `.docs/features/{package}/*` filenames ordered (global slice numbers)
  and slices in sync with code; the next session picks up at the first
  unimplemented slice. All slices `01`–`29` are implemented (core, http, meta,
  env, client, domain, cli, openapi); the roadmap items after them are
  documented at the end of `client/17_client.md`.
- Only commit when explicitly asked.
