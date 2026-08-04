# 15. Final Verification and Wrap-up

## Goal

Run the complete quality gate for this iteration and confirm the framework's
foundation is solid: build, test, and lint all green; the docs reflect the
code; and the next steps are clear.

## Context

Slices `01`–`14` produce:

- A green monorepo baseline.
- `@smitejs/core` — the registrar (nodes, edges, global registry, compile-time
  flag, junction, public API, immutability).
- `@smitejs/http` — the minimal DSL (`app`, `route`, `req`, `accept`,
  `handler`, `serve`) with typed context and zod validation.
- A tree-shaking bundle test proving the runtime-mode contract.
- Foundational docs (`harness.md`, `architecture.md`, `AGENTS.md`) and feature
  slices.

This slice is the gate that closes the iteration.

## Harness alignment

- **KISS** — a short checklist, not a ceremony.
- **DRY** — one set of commands already defined at the root; nothing new.
- **SOLID** — each check validates one layer (compiler, tests, lint).
- **Clean** — the working tree should contain only intended artifacts.

## Design

### The gate

```bash
yarn install   # ensure lockfile is consistent
yarn build     # tsc -b (fp, core, http)
yarn test      # vitest run (fp, core, http suites + bundle test)
yarn check     # biome check .
```

### Expected results

| Command        | Expected outcome                                                       |
| -------------- | ---------------------------------------------------------------------- |
| `yarn install` | exits 0; no workspace errors; lockfile in sync                          |
| `yarn build`   | `dist/` produced for `fp`, `core`, `http`; `tsc -b` exits 0             |
| `yarn test`    | all suites green: `fp`, core registrar, http integration, bundle test   |
| `yarn check`   | Biome clean (formatting, lint, imports)                                 |

### Manual spot-checks

1. **Collect-mode sanity** — the unit suites run with
   `ALLOW_GLOBAL_REGISTRY: "true"` (Vitest define); confirm the registry-based
   assertions pass.
2. **Runtime-mode sanity** — the bundle test asserts
   `ALLOW_GLOBAL_REGISTRY: "false"` output omits `globalRegistry` and still
   serves `/ping`.
3. **Sketch fidelity** — the http example from `packages/http/src/index.ts`
   compiles and dispatches (slice 12 fixture).
4. **Clean tree** — `git status` shows: new `packages/core`, `packages/http`
   sources + tests, root config changes, `.docs/features/*`, docs, AGENTS.
   No stray `dist`, no stale references.

### Wrap-up tasks

- Delete any placeholder code introduced only to satisfy `tsc -b` in slice 01
  (if real sources superseded it).
- Update `packages/http/docs/index.md` if the final API differs from slice 14's
  outline.
- Update `AGENTS.md`'s "next steps" pointer to the first unimplemented feature
  slice (all of `01`–`13` are implemented by this gate).

## Edge cases & error handling

- **Bundle test string-assertion flake**: if esbuild changes how it emits the
  folded constant (or a minifier is later added), relax the assertion to the
  observable contract (no `globalRegistry`, execution works) — documented in
  slice 13.
- **Biome auto-fixable issues**: run `yarn format` before re-running
  `yarn check`; do not hand-fix formatting.
- **Lockfile drift**: commit the `yarn.lock` diff from slice 01 (it reflects
  the new dependency set). Never edit the lockfile by hand.
- **Stale `dist`**: `.gitignore` already ignores `dist`; remove local `dist`
  if it confuses editors, but do not commit it.

## Verification

```bash
yarn install && yarn build && yarn test && yarn check
```

Definition of done:

- All four commands exit 0.
- No remaining references to deleted packages (`express`, `auth`, `spec`,
  `examples`).
- The feature slices `01`–`13` are implemented; `14` (docs) is written; this
  slice documents the gate.

## Dependencies / prerequisites

- All slices `01`–`14`.

## Notes / open questions — the roadmap after this iteration

1. **`@smitejs/cli`** — the `bundle.js` mechanism: bundle the user app with
   `ALLOW_GLOBAL_REGISTRY: "true"`, execute, traverse
   `globalThis.globalRegistry`, and emit artifacts (OpenAPI first).
2. **`@smitejs/serverless`** — `lambdaify(app)` adapting `serve()`'s
   `HttpRouter` to AWS Lambda handlers (API Gateway v1/v2 event → request,
   response → result).
3. **`@smitejs/domain`** — `usecase`, `aggregate`, `specification` builders
   registering nodes/edges under the same registrar.
4. **More core build-time queries** — incoming edges, cycle detection,
   topological ordering, validation reports (for the CLI).
5. **More http DSL** — output specs (`route.output`), response helpers,
   guards/interceptors as graph edges.
