# 04. Relationship Edges (`RelationshipDescriptor` + `relate`)

## Goal

Make every relationship in the application a first-class, traversable IR
element: `relate(from, relation, to)` creates a **relationship descriptor**
(an edge, "an IR of each relationship") *and* appends `to` to `from`'s
runtime child index (a direct child reference). Together with slice
`03_core_node_and_registry`, every DSL call now produces IR for itself (node)
and IR for its wiring (edge).

## Context

The old project modeled relationships implicitly — `controller.data.routes`
and `module.data.byKind` — and registered each component flat in the global
map. The compiler/CLI could not reliably reconstruct *why* two descriptors
were related without executing nested data reads. The dependency-graph skill
from the old project explicitly asks for edges (`controller -> route`,
`route -> handler`, `handler -> usecase`).

We deliver both representations because they serve two different consumers:

- **Relationship descriptors** (in the registry) → the CLI's canonical,
  registry-only traversal (compile time).
- **Child refs** (non-enumerable index on the parent) → the executor's
  registry-free walk at runtime (tree-shakeable, no global state needed).

## Harness alignment

- **KISS** — an edge is a node whose `data` is `{ from, to, relation }`. No
  graph library, no adjacency matrix, no classes.
- **DRY** — one `relate` primitive; every transport (http, scheduler,
  messaging, rpc) uses it rather than re-implementing wiring.
- **SOLID** — the edge shape lives in `@smitejs/core`; transports only choose
  relation *names*. Core depends on nothing; transports depend on core.
- **Clean** — the child index is non-enumerable (invisible to `Object.keys`
  and JSON serialization, like `@smitejs/fp`'s metadata symbols), so IR stays
  clean and serializable while the runtime view stays available.

## Design

### File: `packages/core/src/descriptor.ts` (extended)

Add to the existing file:

```ts
export interface RelationshipDescriptor<
  Rel extends string = string,
  Data = undefined,
> extends Descriptor<
    "relationship",
    Readonly<{
      from: string;
      to: string;
      relation: Rel;
      data: Data;
    }>
  > {}

/** Symbol key for the runtime child index attached to parent descriptors. */
export const children: unique symbol = Symbol.for("@smitejs/core/children");

type ChildIndex = ReadonlyMap<
  string,
  readonly Descriptor<string, unknown>[]
>;

type Parent = Descriptor<string, unknown> & { [children]?: ChildIndex };

export function relate<
  Rel extends string,
  From extends Descriptor<string, unknown>,
  To extends Descriptor<string, unknown>,
  Data = undefined,
>(
  from: From,
  relation: Rel,
  to: To,
  data?: Data,
): RelationshipDescriptor<Rel, Data> {
  appendChild(from, relation, to);

  const relationship = freeze({
    __kind: "relationship",
    __key: `${from.__key}->${relation}->${to.__key}`,
    data: freeze({
      from: from.__key,
      to: to.__key,
      relation,
      ...(data !== undefined ? { data } : {}),
    }),
  });

  if (allowGlobalRegistry) register(relationship);
  return relationship;
}

const appendChild = (
  from: Descriptor<string, unknown>,
  relation: string,
  to: Descriptor<string, unknown>,
): void => {
  const parent = from as Parent;
  const index = parent[children] ?? new Map();
  const current = index.get(relation) ?? [];
  (index as Map<string, readonly Descriptor<string, unknown>[]>).set(relation, [
    ...current,
    to,
  ]);
  Object.defineProperty(parent, children, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: index,
  });
};

export function childrenOf(
  from: Descriptor<string, unknown>,
  relation?: string,
): readonly Descriptor<string, unknown>[] {
  const index = (from as Parent)[children];
  if (index === undefined) return [];
  if (relation === undefined) {
    return [...index.values()].flat();
  }
  return index.get(relation) ?? [];
}
```

Key decisions:

- **Relationship keys are composite and deterministic**:
  `"<from.__key>-><relation>-><to.__key>"`. Uniqueness is guaranteed by node
  key uniqueness (slice 03).
- **`appendChild` is unguarded** — the child index is the *runtime* view the
  executor needs (walk app → routes → endpoints → handlers without touching
  the registry). Only the edge registration is guarded by
  `allowGlobalRegistry`.
- **`childrenOf(from, relation?)`** reads the runtime index; used by
  `serve()` and by the CLI when it needs object identity.
- The `data` spread with `exactOptionalPropertyTypes`: the extra payload is
  omitted unless provided.

### Why a non-enumerable property on the parent (not a WeakMap)?

Two options were considered:

1. **Non-enumerable symbol property on the parent node** (chosen). The parent
   is not yet frozen at creation time (the registry owns mutable build slots;
   `finalizeDescriptor` deep-freezes at the terminal — slice `06`). The
   symbol is invisible to serialization and `Object.keys`.
2. **WeakMap keyed by node** (rejected): hidden module state that is harder to
   reason about and survives in the bundle as a mutable global — worse for the
   "avoid mutable global state" harness.

The chosen approach keeps child refs *on the object they describe*, mirroring
`@smitejs/fp`'s metadata-symbol precedent.

## Implementation steps

1. Extend `packages/core/src/descriptor.ts` with the code above.
2. Move `childrenOf` here (it was introduced conceptually in slice 03's
   registry queries; the runtime index lives here).
3. Export from `packages/core/src/index.ts`:

   ```ts
   export { children, childrenOf, defineDescriptor, relate } from "./descriptor.js";
   export type { Descriptor, RelationshipDescriptor } from "./descriptor.js";
   ```

4. `yarn build` + `yarn test`.

## Edge cases & error handling

- **Duplicate relationship**: calling `relate` twice with the same
  `(from, relation, to)` yields the same composite key → `register` throws a
  duplicate-key error. Callers that legitimately want idempotent wiring must
  guard with `childrenOf(from, relation)` first.
- **Relation name collisions**: relation names are namespaced by convention
  (`"http.route"`, `"http.endpoint"`, `"http.handler"`), preventing ambiguity
  when multiple transports share a parent (the app junction).
- **Orphan edges**: an edge may point to an unregistered node; this is
  surfaced by CLI validation, not by `relate` itself (YAGNI).

## Verification

```bash
yarn build
yarn test
```

Assertions to lock in slice `07_core_registrar_tests`:

- `relate` registers a `"relationship"` descriptor with the composite key.
- `childrenOf(from, "http.route")` returns `[route]`; `childrenOf(from)`
  returns all children across relations.
- `Object.keys(route)` is `["__kind", "__key", "data"]` (child index hidden).
- JSON serialization of the parent does not include the child index.

Definition of done:

- Every wiring creates an edge node in the registry **and** a runtime child
  ref on the parent.
- `childrenOf` lets an executor walk the graph with no registry access.

## Dependencies / prerequisites

- Slice `03_core_node_and_registry` (`Descriptor`, `register`,
  `allowGlobalRegistry`, `freeze`).

## Notes / open questions

- Relation *types* (a closed union of known relations) are deliberately not
  modeled — transports own their relation names and core stays agnostic
  (Open/Closed). If cross-package validation of relation names becomes
  necessary, a registry-level relation schema can be added later.
- The `"relationship"` kind string is a magic constant; extracted to a
  `RelationshipKind` const only if it appears in more than one file (DRY rule).
