# 02. Compile-Time Flag `ALLOW_GLOBAL_REGISTRY`

## Goal

Introduce the single compile-time constant that gates all **collect-mode**
behavior. When the constant is `false`, esbuild must be able to fold the
guarded branches away entirely (dead-code elimination); when it is `true` (or
undefined), the registrar collects descriptors into the global registry.

This constant is the seam between the two worlds the framework lives in:

- **Collect mode** (`true`): the compiler/CLI bundles the app, executes it, and
  traverses `globalThis.globalRegistry` (the `bundle.js` mechanism).
- **Runtime mode** (`false`): the executor runs with zero registry
  infrastructure in the bundle.

## Context

The old `~/projects/smite` project shipped exactly this pattern in
`src/core/descriptor.ts`:

```ts
declare const ALLOW_GLOBAL_REGISTRY: boolean;
declare const globalRegistry: Map<string, Descriptor<DescriptorKind, any>>;

export function defineDescriptor(...) {
  const descriptor = { __kind: kind, __key: key, data };
  ALLOW_GLOBAL_REGISTRY && globalRegistry?.set(key, descriptor);
  return descriptor;
}
```

and its build script passed `define: { ALLOW_GLOBAL_REGISTRY: "true" }` to
esbuild. Its Vitest config passed `"false"`. We keep the same identifier and
semantics, but make the *default* explicit and safe.

## Harness alignment

- **KISS** — one constant, one file, no configuration objects, no runtime
  switches.
- **DRY** — the constant is defined once in `@smitejs/core` and imported by every
  guarded module; no stringly-typed flags scattered around.
- **SOLID** — the Open/Closed principle in practice: the collector behavior is
  *closed* to changes and *open* to being enabled/disabled by the bundler.
- **Clean** — the folded-away branch is physically absent from runtime output;
  no dead code survives.

## Design

### File: `packages/core/src/constants.ts`

```ts
/**
 * Compile-time flag, replaced by bundlers:
 *   - collect mode  (CLI/compiler):  define ALLOW_GLOBAL_REGISTRY="true"
 *   - runtime mode  (user's esbuild):define ALLOW_GLOBAL_REGISTRY="false"
 */
declare const ALLOW_GLOBAL_REGISTRY: boolean;

export const allowGlobalRegistry: boolean =
  typeof ALLOW_GLOBAL_REGISTRY === "boolean" && ALLOW_GLOBAL_REGISTRY;
```

### Why `typeof ... === "boolean" && ...`?

The bare identifier `ALLOW_GLOBAL_REGISTRY` is never evaluated directly unless
the bundler replaced it with a literal:

| Situation                                    | `typeof ALLOW_GLOBAL_REGISTRY` | Result |
| -------------------------------------------- | ------------------------------ | ------ |
| esbuild `define` → `true`                    | `"boolean"`                    | `true` |
| esbuild `define` → `false`                   | `"boolean"`                    | `false`|
| No bundler (plain Node, no define)           | `"undefined"`                  | `false`|

- When a bundler **defines** the constant, esbuild substitutes the literal and
  constant-folds the whole expression:
  `typeof false === "boolean" && false` → `false`.
- When nothing defines it, `typeof ALLOW_GLOBAL_REGISTRY` is `"undefined"`, so
  the expression safely yields `false` instead of throwing `ReferenceError` (a
  bare `ALLOW_GLOBAL_REGISTRY && ...` would throw).
- The exported `allowGlobalRegistry` is a convenience mirror of the fold; the
  **guards in `descriptor.ts` must reference the raw identifier inline**
  (`typeof ALLOW_GLOBAL_REGISTRY === "boolean" && ALLOW_GLOBAL_REGISTRY`), not
  this exported const. esbuild's `define` substitutes only the literal
  identifier, so an imported const binding cannot be folded and would keep the
  registry in runtime bundles (see `13_tree_shaking_bundle_test.md`).

### TypeScript mechanics

`declare const ALLOW_GLOBAL_REGISTRY: boolean;` inside a module is a pure
type-level ambient declaration: it emits **no JavaScript**. The emitted code
only references the identifier inside `typeof`, which is the standard idiom for
this pattern.

## Implementation steps

1. Create `packages/core/src/constants.ts` with the exact content above.
2. Create `packages/core/src/index.ts` placeholder `export {}` (if not already
   present from slice 01) and re-export the constant so later slices import it
   from `@smitejs/core`:

   ```ts
   export { allowGlobalRegistry } from "./constants.js";
   ```

   (NodeNext + `verbatimModuleSyntax` require the explicit `./constants.js`
   extension in relative imports.)
3. Run `yarn build` and `yarn test`.

## Edge cases & error handling

- **Missing define in production**: default is `false` (runtime mode), so a user
  who forgets to define the flag still gets a working app — without any registry
  infrastructure. Collect mode requires an explicit
  `define: { ALLOW_GLOBAL_REGISTRY: "true" }` (the CLI/compiler does this).
  Documented, not errored: KISS.
- **`esbuild` `define` applies to `typeof`**: yes — that is what enables the
  constant folding above. This is a documented, intentional dependency on
  esbuild semantics (the user-facing build tool, per requirements).
- **Multiple flags later**: if other compile-time constants are needed
  (e.g. `SMITE_DEBUG`), add them to the same file following the identical
  pattern (DRY by convention, not by abstraction).

## Verification

```bash
yarn build
yarn test
```

Plus a direct sanity check of folding semantics (run from repo root):

```bash
node -e "
const esbuild = require('esbuild');
esbuild.build({
  stdin: {
    contents: 'declare const ALLOW_GLOBAL_REGISTRY: boolean; export const f = typeof ALLOW_GLOBAL_REGISTRY === \"boolean\" && ALLOW_GLOBAL_REGISTRY;',
    resolveDir: process.cwd(),
  },
  bundle: false,
  write: false,
  define: { ALLOW_GLOBAL_REGISTRY: 'false' },
}).then(r => { const out = r.outputFiles[0].text; console.log(out); if (out.includes('false')) console.log('FOLDED OK'); });
"
```

Expected output contains only the literal `false` — proving the branch folds.

Definition of done:

- `allowGlobalRegistry` is exported from `@smitejs/core`.
- With `define: false`, esbuild output contains the folded `false` and no
  `typeof` remnant.

## Dependencies / prerequisites

- Slice `01_bootstrap_workspace` (esbuild available in the workspace).

## Notes / open questions

- Default is `false` when the flag is undefined, so runtime-mode safety holds
  even without bundler configuration. Registrar tests enable collect mode via
  the Vitest `define` in `vitest.config.ts`.
