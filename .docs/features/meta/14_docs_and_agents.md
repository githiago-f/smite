# 14. Documentation and AGENTS (`harness.md`, `architecture.md`, `AGENTS.md`)

## Goal

Redesign the project's foundational documentation to match the new
registry-first architecture, and initialize `AGENTS.md` so future AI/human
contributors follow the same rules. Also fill the per-package `docs/index.md`
files that are currently empty.

## Context

The previous `harness.md`, `architecture.md`, and `AGENTS.md` were deleted in
the rework (they described the old descriptor-tree/Express era). The old
`~/projects/smite/.agents/skills/*` articulate the intended philosophy
(descriptor-first, build-time vs runtime separation, compile-time constants,
graph modeling) and should be distilled into these files. KISS / DRY / SOLID /
Clean are now the stated harnesses.

## Harness alignment

- **KISS** — three concise, single-purpose documents; no encyclopedia.
- **DRY** — one source of truth per concept; docs reference code, never
  duplicate it.
- **SOLID** — `architecture.md` documents the layers and their dependencies;
  `harness.md` documents *how to decide*; `AGENTS.md` documents *how to work*.
- **Clean** — docs stay current or are removed; examples live in tests.

## Design

### `.docs/harness.md` — the engineering heuristics

Sections:

1. **Objective** — simple, predictable, composable, testable, extensible,
   maintainable.
2. **Guiding principles** — KISS, DRY, SOLID, Clean (each with 2–3 concrete
   "we do / we don't" rules).
3. **Decision process** — understand → reuse → extend → replace → introduce.
4. **Compile-time first** — runtime is expensive; move work into the compiler;
   guard optional behavior with compile-time constants (`ALLOW_GLOBAL_REGISTRY`)
   that esbuild folds.
5. **Runtime/build-time separation** — descriptors are build-time metadata;
   executors are runtime; registries never leak into production bundles.
6. **Tree-shaking contract** — `sideEffects: false` everywhere; build-time code
   must be removable; verify with bundle tests (slice 13).
7. **Functional by default** — immutable IR (freeze/finalize), pure builders,
   deterministic outputs; avoid mutable global state.
8. **Testing philosophy** — public-API tests; behavior over implementation;
   collect-mode unit tests + runtime-mode bundle tests.
9. **Monorepo rules** — one responsibility per package; stable public APIs;
   one-way dependencies; no cycles.
10. **Decision checklist** — the pre-merge questions (adapted from the old
    harness).

### `.docs/architecture.md` — the system structure

Sections:

1. **Vision** — a compile-time-first framework; users write declarative
   TypeScript DSL; esbuild builds; a CLI compiles the app with collect mode,
   executes it, and traverses `globalThis.globalRegistry` to generate
   artifacts.
2. **Layers** (top-down):

   ```
   Application DSL (builders)
   → Semantic Registry (IR: nodes + edges, global)
   → Compiler / CLI (compile → execute → traverse)
   → Artifact generators (OpenAPI, infra, docs)   [future]
   → Runtime executors (http serve, serverless adapters)
   ```

3. **IR model** — `Descriptor` (node), `RelationshipDescriptor` (edge),
   composite keys, `relate`, child index (runtime view), global registry
   (compile-time view).
4. **Packages** — `@smite/core` (registrar), `@smite/http` (http DSL +
   executor), `@smite/fp` (functional primitives), `@smite/domain`,
   `@smite/serverless`, `@smite/cli` (stubs; single responsibility each).
5. **Compile-time constants** — the `ALLOW_GLOBAL_REGISTRY` table (true /
   false / undefined).
6. **Tree-shaking** — what survives vs what is dropped.
7. **Validation** — zod-only, declared in `req`/input configs.

### `AGENTS.md` (root)

Short, actionable, for AI agents and humans:

- Repo layout and build/test/lint commands (`yarn build`, `yarn test`,
  `yarn check`).
- The harnesses (KISS, DRY, SOLID, Clean) — one-line definitions plus "when in
  doubt, ask."
- Architecture invariants to preserve:
  - IR is nodes + edges; never mutate frozen IR; use `refine` before
    `finalizeDescriptor`.
  - Registry code must be tree-shakeable; never import the registry from
    executor paths.
  - Validation is zod-only.
  - esbuild-first builds; `sideEffects: false`.
  - One-way dependencies (core ← http ← serverless/cli); no cycles.
  - `verbatimModuleSyntax` (use `import type`), `exactOptionalPropertyTypes`
    (omit, don't `undefined`).
  - Feature docs live in `.docs/features/{order}_{name}.md`; keep slices
    ordered and up to date.
- Do/don't list: don't commit secrets, don't run `git` commands without being
  asked, don't add comments unless asked (code style), prefer small focused
  changes.

### Package docs

- `packages/core/docs/index.md` — the registrar contract (nodes, edges,
  registry, constants) with a usage example mirroring slice 07 tests.
- `packages/http/docs/index.md` — the DSL + serve with the sketch example
  (mirroring slice 12 tests).

Both stay short and point to the tests as the runnable examples (DRY).

## Implementation steps

1. Write `.docs/harness.md` and `.docs/architecture.md` (replacing deleted
   originals — git sees them as new files; that is fine per scope).
2. Write `AGENTS.md`.
3. Fill `packages/core/docs/index.md` and `packages/http/docs/index.md`.
4. `yarn check` (Biome ignores markdown, but confirm no config churn).

## Edge cases & error handling

- **Doc/behavior drift**: docs that describe API must be validated by the
  tests in slices 07 and 12; if a test contradicts a doc, the test wins.
- **Length creep**: each doc gets a hard "keep it terse" edit; long-form
  rationale belongs in `.docs/features/*` slices, not in the top-level docs.

## Verification

- Read through each doc for internal consistency with the implemented code.
- `yarn test` still green (docs-only change).
- `git status` shows exactly the new/updated docs, AGENTS, and features.

Definition of done:

- Three documents exist, are consistent with the code, and encode the KISS /
  DRY / SOLID / Clean harnesses and the tree-shaking + registry invariants.
- `AGENTS.md` would successfully guide a fresh agent to run tests, build, and
  follow the architecture rules.

## Dependencies / prerequisites

- Slices `01`–`13` (the implemented behavior the docs describe).

## Notes / open questions

- The old `~/projects/smite/.agents/skills/*` are *lineage*, not authoritative
  for this repo. If skills are re-introduced, they must be rewritten against
  the new architecture (deferred).
- `AGENTS.md` should list the `.docs/features` slices as the current plan of
  record so the next session picks up at the first unimplemented slice.
