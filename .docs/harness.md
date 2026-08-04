# Harness

The engineering heuristics for Smite. Code wins over prose: every rule here is
exercised by the tests in `packages/*/src/*.test.ts`.

## Objective

Simple, predictable, composable, testable, extensible, maintainable. In that
order.

## Guiding principles

**KISS** — smallest thing that works.

- Do: one constant, one file, one responsibility.
- Don't: configuration objects, runtime switches, clever indirection.

**DRY** — one source of truth per concept.

- Do: docs reference code and tests; helpers live once in the lowest package.
- Don't: duplicate a rule in three places with drift.

**SOLID** — single responsibility, stable boundaries.

- Do: one package = one concern; open/closed via public APIs.
- Don't: executors reaching into registrars' internals.

**Clean** — code that documents itself.

- Do: terse files, descriptive names, tests as examples.
- Don't: comments explaining *what* (read the code), dead code, stale docs.

## Decision process

`understand → reuse → extend → replace → introduce`. Read the existing
slices in `.docs/features/` (grouped by package) before writing new code.

## Compile-time first

Runtime is expensive; move work into the compiler. Guard optional behavior
with compile-time constants (`ALLOW_GLOBAL_REGISTRY`) that esbuild `define`
substitutes and folds. If behavior can be decided at build time, it should be.

## Runtime/build-time separation

- **Descriptors** are build-time metadata: nodes (`Descriptor`) and edges
  (`RelationshipDescriptor`), composite keys, registered into the global
  registry only in collect mode.
- **Executors** are runtime: they walk the IR via child refs
  (`childrenOf`), never via the registry.
- The registry must never leak into production bundles (proven by
  `packages/http/src/tree-shake.test.ts`).

## Tree-shaking contract

- Every package sets `sideEffects: false`.
- Build-time code must be removable; the guard that makes it removable must
  reference the **raw** `ALLOW_GLOBAL_REGISTRY` identifier inline (esbuild
  `define` substitutes only the literal identifier — an imported const binding
  cannot be folded).
- Verify with bundle tests, not just unit tests.

## Functional by default

Immutable IR: descriptors are frozen at creation (`freeze`), subtrees at
`finalizeDescriptor` (`deepFreeze`). Builders are pure. Avoid mutable global
state — the only global is the registry, and only in collect mode.

## Testing philosophy

- Test the **public API**; assert behavior, not implementation.
- Unit suites run in **collect mode** (Vitest `define:
  ALLOW_GLOBAL_REGISTRY: "true"`).
- Runtime mode is proven by a **bundle test** (`define: "false"`): assert the
  observable contract (no `globalRegistry`, executor works). Behavior is the
  contract; string-matching is a proxy.
- When a doc contradicts a test, the test wins.

## Monorepo rules

- One responsibility per package; stable public APIs (`@smitejs/*` barrel).
- One-way dependencies, no cycles: `fp`/`core` base → `http` →
  `serverless`/`cli`.
- Packages import from the `@smitejs/*` public API only, never each other's
  internals.

## Decision checklist

Before committing a change:

- Is this the simplest thing that works?
- Is there one source of truth, referenced not duplicated?
- Does it preserve the runtime/build-time boundary?
- Does it stay tree-shakeable (`sideEffects: false`, raw-identifier guards)?
- Are types strict-safe (NodeNext, `verbatimModuleSyntax`,
  `exactOptionalPropertyTypes`)?
- Is validation zod-only?
- Are tests green and does the change ship with its test?
