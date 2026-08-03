# 01. Bootstrap the Workspace

## Goal

Get the monorepo to a **green baseline**: a single `yarn install` leaves us with
`yarn build`, `yarn test`, and `yarn check` all passing, with only the
`@smite/fp` package compiling and testing. Every later slice builds on this
baseline, so it must be reproducible and boring.

## Context

The repository is being rebuilt from scratch. The remaining tree contains:

- `packages/fp` — fully implemented, with `package.json` + `tsconfig.json`.
- `packages/core`, `packages/http` — empty `package.json` / `tsconfig.json`
  and only design sketches (`index.d.ts` / `index.ts`).
- `packages/domain`, `packages/serverless`, `packages/cli` — stubs, out of scope
  for this iteration.
- A root `package.json` whose `workspaces` still lists `examples/*` (does not
  exist) and whose `spec` script references a deleted
  `examples/http/dist/components.js`.
- A `tsconfig.build.json` referencing deleted packages
  (`express`, `auth`, `spec`, `examples/http`).
- An empty `node_modules` (the `.yarn-integrity` marker is gone).

## Harness alignment

- **KISS** — do the minimum needed to make build/test/lint work; do not add
  tooling we will not use this iteration.
- **DRY** — every workspace package shares the same `tsconfig` shape; the root
  `tsconfig.json` holds the shared compiler options and each package
  `extends` it.
- **SOLID** — the root defines *interfaces* (the build graph), each package is
  a single responsibility; `tsconfig.build.json` is the *composition root*.
- **Clean** — remove stale scripts, stale references, and self-dependencies;
  the tree should describe what actually exists.

## Design

### Root `package.json`

Replace the whole file with a minimal, accurate manifest:

```jsonc
{
  "name": "smitejs",
  "version": "1.0.0",
  "description": "",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "tsc -b tsconfig.build.json",
    "check": "biome check .",
    "format": "biome format --write .",
    "test": "vitest run"
  },
  "keywords": [],
  "author": "",
  "license": "MIT",
  "type": "module",
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "esbuild": "^0.24.2",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

Notes:

- `workspaces` becomes `["packages/*"]` — `examples/*` does not exist.
- The `spec`, `docs:*`, and `release:*` scripts are removed; they reference
  deleted artifacts and will be reintroduced when the compiler exists.
- `esbuild` is added now because slice `13_tree_shaking_bundle_test` requires
  it; adding it here avoids a second lockfile churn.
- No runtime `dependencies` at the root — runtime deps belong to workspaces.

### `tsconfig.build.json`

```jsonc
{
  "files": [],
  "references": [
    { "path": "./packages/fp" },
    { "path": "./packages/core" },
    { "path": "./packages/http" }
  ]
}
```

`tsc -b` composes only these three project references. `domain`, `serverless`,
and `cli` are excluded until they have real source.

### `vitest.config.ts` (new, at root)

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@smite/core": resolve(import.meta.dirname, "packages/core/src/index.ts"),
      "@smite/http": resolve(import.meta.dirname, "packages/http/src/index.ts"),
    },
  },
  define: {
    ALLOW_GLOBAL_REGISTRY: "true",
  },
  test: {
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
```

Why:

- `alias` maps the workspace names to their **source** entry, so tests exercise
  TypeScript directly and never depend on a prior `yarn build`.
- `define.ALLOW_GLOBAL_REGISTRY: "true"` is the *collect* mode used by the
  registrar tests (see slice `02_core_compile_time_flag`). It is a compile-time
  literal that esbuild folds; nothing about it leaks to production.

### `packages/core` and `packages/http` scaffolding

Both packages get the same shape, mirroring `packages/fp`:

`packages/core/package.json`:

```jsonc
{
  "name": "@smite/core",
  "version": "0.1.0",
  "description": "Semantic registrar: descriptors (IR nodes), relationships (IR edges) and the global registry.",
  "license": "MIT",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist", "!dist/**/*.test.*", "!dist/.tsbuildinfo"],
  "publishConfig": { "access": "public" },
  "scripts": { "build": "tsc -b", "test": "vitest run" },
  "sideEffects": false
}
```

`packages/core/tsconfig.json`:

```jsonc
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "references": []
}
```

`packages/http` gets the same two files (name `@smite/http`), with
`dependencies` added in later slices (`zod`, `path-to-regexp`) and no
`references` yet (it will gain `{ "path": "../core" }` once it imports core —
added in slice `08_http_app_and_route`).

`sideEffects: false` is the **tree-shaking contract**: it tells bundlers every
module's top-level statements are side-effect-free, so unused exports can be
dropped. It is a hard requirement of the whole framework (see
`13_tree_shaking_bundle_test`).

### Cleanups

1. `packages/fp/package.json` currently declares a self-dependency
   `"@smite/fp": "0.1.0"`. Remove it — a package must not depend on itself.
2. `packages/fp/dist` is stale build output; `yarn install`/`yarn build` will
   regenerate it. Remove it to avoid confusion.
3. `packages/core/src/index.d.ts` and `packages/http/src/index.ts` are design
   sketches; they are replaced by real sources in slices `03..11`. Leave them
   in place until then (they do not participate in `tsc -b` because their
   `tsconfig.json` only includes `src/**/*.ts` — `index.d.ts` is fine, but we
   will overwrite them soon anyway).

## Implementation steps

1. Overwrite `package.json`, `tsconfig.build.json`; add `vitest.config.ts`.
2. Create `packages/core/package.json` and `packages/core/tsconfig.json`.
3. Create `packages/http/package.json` and `packages/http/tsconfig.json`.
4. Remove the `@smite/fp` self-dependency and the stale `packages/fp/dist`.
5. Run `yarn install`.
6. Run `yarn build` — must compile `fp`, `core`, `http` (empty sources are fine
   as long as at least one file exists; create a placeholder `src/index.ts` in
   each if `tsc -b` complains about an empty program).
7. Run `yarn test` — `packages/fp/src/index.test.ts` must pass.
8. Run `yarn check` — Biome must not report errors on the touched files.

## Edge cases & error handling

- **Empty program error**: `tsc -b` fails with `No inputs were found` if a
  referenced project has an empty `src`. Create a minimal placeholder
  `export {}` in `src/index.ts` for `core` and `http` until real sources land.
- **Lockfile drift**: `yarn.lock` is old; `yarn install` may rewrite it. Accept
  the diff — it is a legitimate consequence of the dependency change.
- **Biome vs generated `dist`**: Biome already ignores `dist` and
  `node_modules` via `biome.json`; keep generated output out of formatting.
- **`verbatimModuleSyntax`**: all type-only imports must use `import type`.
  The `tsconfig.json` already enables it; every new file must respect it.
- **`exactOptionalPropertyTypes`**: optional properties must be omitted
  (spread) rather than set to `undefined`. The registrar and http code in later
  slices rely on this, so get used to the pattern now.

## Verification

```bash
yarn install
yarn build
yarn test
yarn check
```

Definition of done:

- `yarn build` exits 0 and produces `packages/fp/dist/*` (and empty `core` /
  `http` dist output if placeholders were used).
- `yarn test` runs the `fp` suite green (and no tests yet for core/http).
- `yarn check` is clean.
- `git status` shows no leftover references to `examples`, `express`, `auth`,
  or `spec`.

## Dependencies / prerequisites

- Node >= 20 (`.nvmrc` pins `lts/krypton`; local runtime is `v25.2.1`).
- Yarn Classic 1.x (local: `1.22.22`).

## Notes / open questions

- Biome version stays `^1.9.4` (already in the lockfile). Upgrade later, not
  now — KISS.
- Vitest `2.1.1` and esbuild `^0.24.2` are pinned to versions known to work
  with Node 24+; bump only if install fails.
