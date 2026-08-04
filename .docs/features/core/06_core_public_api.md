# 06. Core Public API (barrel, `refine`, `finalizeDescriptor`)

## Goal

Close out the `@smitejs/core` public surface:

1. A **barrel** (`src/index.ts`) exposing the exact, minimal API consumers and
   tooling rely on.
2. **`refine`** — the single sanctioned way for builders to evolve a node's
   `data` while preserving node identity (so child refs stay valid).
3. **`finalizeDescriptor`** — the terminal that deep-freezes the reachable
   IR subtree, giving consumers a guarantee of immutability once declaration
   ends.

## Context

Builders (e.g. `http.route(app).req(config)`) need to add data to an already
registered node without breaking the child references established at creation.
Two prior designs were rejected for complexity:

- Immutable re-registration (new node, re-link parents) — error-prone and
  against KISS.
- Mutating fields ad-hoc everywhere — against Clean (no single mutation path).

`refine` centralizes mutation; `finalizeDescriptor` ends it.

## Harness alignment

- **KISS** — two small functions, no builder framework.
- **DRY** — one mutation helper (`refine`) and one immutability helper
  (`finalizeDescriptor`) instead of every transport re-implementing freezing
  or spreading.
- **SOLID** — Open/Closed: `Descriptor` is closed; `refine`/`finalize` are the
  open, controlled extension points.
- **Clean** — the "build phase is mutable, the runtime phase is frozen"
  boundary is explicit and enforced at the API level.

## Design

### File: `packages/core/src/descriptor.ts` (extended)

```ts
import { deepFreeze, freeze } from "./internal/freeze.js";

/** Replace the node's data with a frozen shallow-merged snapshot. */
export function refine<Data>(
  descriptor: { data: Data },
  patch: Partial<Data>,
): void {
  (descriptor as { data: Data }).data = freeze({
    ...descriptor.data,
    ...patch,
  });
}

/**
 * Deep-freeze the IR reachable from `root`: the node, its data, and every
 * child (via the child index), recursively. Guards against cycles.
 */
export function finalizeDescriptor<
  D extends Descriptor<string, unknown>,
>(root: D): D {
  const seen = new Set<Descriptor<string, unknown>>();

  const visit = (node: Descriptor<string, unknown>): void => {
    if (seen.has(node)) return;
    seen.add(node);

    for (const child of childrenOf(node)) {
      visit(child);
    }

    deepFreeze(node);
  };

  visit(root);
  return root;
}
```

Notes:

- `refine` takes a structural `{ data: Data }` (TypeScript allows passing a
  `Descriptor` because property assignment compatibility ignores
  `readonly`). It always writes a **frozen** snapshot so every intermediate
  data view is already immutable.
- `finalizeDescriptor` walks the child index *before* freezing each node so
  traversal sees writable nodes; the `seen` set makes it cycle-safe. After it
  returns, `refine` on any reachable node would throw (frozen shell), which is
  exactly the desired hardening.
- Deep-freezing a `Map` (the child index) is safe: `Object.freeze(map)`
  prevents `set`/`clear`; entries are intentionally left untouched.

### File: `packages/core/src/index.ts` (barrel)

Final public surface:

```ts
export { createApp } from "./app.js";
export type { AppDescriptor } from "./app.js";

export { allowGlobalRegistry } from "./constants.js";

export {
  children,
  childrenOf,
  defineDescriptor,
  finalizeDescriptor,
  refine,
  relate,
} from "./descriptor.js";
export type { Descriptor, RelationshipDescriptor } from "./descriptor.js";

export { clear, lookup, lookupAll, register, relationships } from "./registry.js";
```

What is deliberately **not** exported:

- `freeze` / `deepFreeze` (internal helpers) — consumers should not freeze
  ad-hoc; they use `finalizeDescriptor`.
- The child-index internal types.

### Stability contract

This barrel is the **public API** of `@smitejs/core`. Later slices import only
from `@smitejs/core`, never from `./descriptor.js` paths of another package
(monorepo rule: packages communicate through stable public APIs).

## Implementation steps

1. Add `refine` and `finalizeDescriptor` to `packages/core/src/descriptor.ts`.
2. Overwrite `packages/core/src/index.ts` with the barrel above.
3. `yarn build` + `yarn test`.

## Edge cases & error handling

- **Refining a frozen node**: after `finalizeDescriptor`, `refine` throws
  `TypeError` (frozen shell). Callers must refine before finalizing — the
  natural order (build then serve).
- **Cycles**: `finalizeDescriptor` terminates via the `seen` set; a
  self-referencing edge cannot infinite-loop it.
- **`refine` on unknown keys**: a `patch` containing keys absent from the
  current data simply extends the snapshot. That is intended for transport
  data (e.g. adding `req` to a route node).

## Verification

```bash
yarn build
yarn test
```

Assertions locked in slice `07_core_registrar_tests`:

- `refine(node, { a: 1 })` keeps node identity, returns frozen snapshot data.
- `finalizeDescriptor(root)` freezes node, data, and child nodes; subsequent
  `refine` throws.
- The barrel exports resolve with correct types under `verbatimModuleSyntax`.

Definition of done:

- `@smitejs/core` exposes exactly the documented surface; `yarn build` emits a
  clean `dist/index.d.ts`.

## Dependencies / prerequisites

- Slices `03`, `04`, `05` (descriptor, registry, edges, app).

## Notes / open questions

- `finalizeDescriptor` lives in core but is *invoked* by transports'
  terminals (`http.serve`). An alternative (CLI calls it before artifact
  generation) would double as a validation boundary; revisit when the CLI
  exists.
- The `{ data: Data }` parameter shape of `refine` is a pragmatic widening; if
  strictness complaints appear, add an overload rather than a cast (Clean).
