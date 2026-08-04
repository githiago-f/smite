# 20. `@smitejs/domain` package foundation

## Goal

Stand up the `@smitejs/domain` package as a first-class workspace: dependency
(`@smitejs/core`, `@smitejs/fp`, `zod`), tsconfig references, root build/test/alias
wiring, a typed public barrel, and green scaffolding (`index.test.ts`,
`docs.test.ts`). This slice delivers zero behavioral builders — it makes the
package compile, test, and lint clean so `21`–`26` land on solid ground.

## Context

The roadmap (`meta/15_final_verification.md`) assigns `@smitejs/domain`:
`usecase`, `aggregate`, `specification` builders registering nodes/edges under
the same registrar. The package is currently a stub (`package.json`,
`tsconfig.json`, empty `docs/index.md`, and an exploratory `src/index.d.ts`).
This slice replaces the stub with the real skeleton and codifies the design
constraints the following slices honor. `aggregate` is intentionally **deferred**
to a follow-up slice beyond `26` (the "Full DDD toolkit" scope covers
value-object/entity, port/repository, specification, usecase + CQRS first).

## Design

### Design constraints (applied across `domain/20`–`26`)

1. **DRY — reuse `@smitejs/fp`, never re-implement monads.** `Result`, `Task`,
   `TaskResult`, `Option`, `flow`, predicates and extractor metadata all live
   in `@smitejs/fp`. `@smitejs/domain` is a thin *DDD vocabulary layer*: it wraps
   these existing primitives and decorates them with IR nodes — it adds no new
   functor/monad machinery.
2. **Functional core, imperative shell.** Every usecase is a pure pipeline that
   returns `TaskResult`; all I/O sits behind injected ports. Side effects happen
   only in the ports the caller supplies. Nothing in `@smitejs/domain` performs
   I/O itself.
3. **KISS — no DI container, no IoC magic.** Ports are plain TypeScript
   interfaces; an implementation is injected via `usecase(...).with(deps)`
   partial application. There is no `ServiceProvider`, no decorators, no
   reflection.
4. **SOLID mapping** (the reason these units exist):
   - **S** — one usecase = one function/file; one domain unit = one builder.
   - **O** — specifications are open/closed: composed with `and`/`or`/`not`
     without editing their bodies.
   - **I** — ports are narrow; a `ReadPort` is a different contract from a
     `WritePort`.
   - **L** — any implementation of a port substitutes transparently; tested with
     a swap-in-memory/fake.
   - **D** — usecases depend on the port contract, never a concrete store.
5. **Hybrid IR, compile-time-first.** Every builder `defineDescriptor`/`relate`s
   a `domain.*` node, guarded by the raw inline
   `typeof ALLOW_GLOBAL_REGISTRY === "boolean" && ALLOW_GLOBAL_REGISTRY` check
   (AGENTS.md tree-shaking contract). In **collect** mode the CLI sees the
   `domain` graph; in **production** the registry folds out and the functional
   core survives. Proven by a bundle test in `25`.
6. **Validation is zod-only.** Command input and value-object shapes validate
   with `z`; failures return `Result.err` — never a thrown exception.
7. **`sideEffects: false`**, `moduleResolution: NodeNext` (`.js` imports),
   `verbatimModuleSyntax` (`import type`), `exactOptionalPropertyTypes` (omit vs
   `undefined`). No comments unless asked.

### API surface (owned by this slice)

The `packages/domain/src/index.ts` barrel re-exports all units. Foundations
slices only export a placeholder plus the invariants doc; the units arrive in
`21`–`24`.

## Implementation steps

1. `packages/domain/package.json` — name `@smitejs/domain`, deps
   `@smitejs/core` (`workspace:*` via path), `@smitejs/fp`, `zod`; `exports: ".";
   types ./dist/index.d.ts; default ./dist/index.js`; `sideEffects: false`;
   `files: ["dist", "!dist/**/*.test.*", "!dist/.tsbuildinfo"]`. Drop the `zod`
   version mismatch risk by matching the root's zod version.
2. `packages/domain/tsconfig.json` — `rootDir: src`, `outDir: dist`,
   `tsBuildInfoFile: dist/.tsbuildinfo`, **excludes `*.test.ts`**, `references`
   to `../fp` and `../core` (dependency direction `fp`/`core` → `domain`; no
   `@smitejs/http` at this layer).
3. Root `tsconfig.build.json` — add `{ "path": "./packages/domain" }`; place it
   after `core` (it depends on `fp` + `core`).
4. `vitest.config.ts` — add `@smitejs/domain` alias →
   `packages/domain/src/index.ts` (mirror the sibling entries).
5. `src/index.ts` — empty barrel now; grows in `21`–`24`. Export nothing yet
   (or a single `const domainVersion` placeholder) so the package imports
   cleanly.
6. `src/index.test.ts` — smoke test asserting the package loads and the barrel
   resolves (guards against a broken `sideEffects`/exports setup).
7. `src/docs.test.ts` — the per-package docs-integrity harness (copied from
   `packages/{http,client,env}/src/docs.test.ts` and adjusted to `@smitejs/domain`):
   walks `src/**/*.ts`, asserts every `@example <Title>` resolves to a tested
   `#section` snippet, and renders as a `ts` fence. It passes trivially while no
   `@example` exists and enforces everything added later.
8. `docs/index.md` — package landing stub (expanded in `26`).

## Edge cases & error handling

- **Dependency cycle**: `@smitejs/domain` must import only `@smitejs/fp` and
  `@smitejs/core`; importing `@smitejs/http` would break the one-way
  `fp`/`core → domain → http/serverless/cli` wall. `25` uses a *cooperative*
  integration where `@smitejs/http` detects the domain usecase reference, not a
  `domain → http` import.
- **`sideEffects: false` + zod**: keep zod a runtime import in the units, but
  mark the barrel side-effect-free so esbuild can prune unused `domain`
  descriptors.
- **Dist vs src**: tests import via the vitest alias (src); the example app
  (`26`) will import the built dist. Keep `files` minimal so dist ships.
- **Pre-existing Biome violations**: repo-wide `yarn biome check` still reports
  the five known offenders (core `registry.ts`, fp `noArguments`, serverless
  anys) — do not "fix" them. `@smitejs/domain` must add **zero** new violations.

## Definition of done

- `yarn build` compiles with `tsc -b` including `packages/domain`.
- `yarn test` runs a green domain suite (scaffold + docs integrity).
- `yarn format && yarn biome check packages/domain` clean.
- `packages/domain` appears in `tsconfig.build.json` and the `vitest.config.ts`
  alias; no `@smitejs/http`/registry dependency.

## Dependencies / prerequisites

- Slices `01`–`19` (all implemented), especially `core/03`–`07` (descriptor
  fabric + guard) and `@smitejs/fp` (Result/TaskResult/flow primitives).
- `zod` already present at root.

## Notes / open questions

- The slice files live under `.docs/features/domain/` per the reorganization
  that grouped feature slices by package; `domain` is the current focus.
- The stub `src/index.ts` (sketch of `usecase`/`aggregate`/`specification`) is
  thrown away; its final shapes are defined by `21`–`24`, not the sketch.