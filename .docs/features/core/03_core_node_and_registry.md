# 03. IR Node (`Descriptor`) and the Global Registry

## Goal

Implement the two most fundamental primitives of the registrar:

1. **`Descriptor`** — the immutable IR *node* that every DSL call produces ("an
   IR of itself").
2. **The global registry** — the single `Map` on `globalThis` that holds every
   node (and, later, every relationship edge), enabling the compiler/CLI to
   compile with collect mode and traverse all descriptors.

This slice delivers `@smite/core`'s identity: one stable, typed, serializable
node shape plus a traversable store.

## Context

The core sketch (`packages/core/src/index.d.ts`) already spells the shape:

```ts
export interface Descriptor<TKind extends string, TData> {
  __kind: TKind;
  __key: string;
  data: TData;
}
```

The old project registered into a bare global `globalRegistry` Map. We keep
that decision (global-only, per scope) because the CLI executes the compiled
bundle in a fresh context and must read the map *after* module evaluation —
the `bundle.js` flow.

## Harness alignment

- **KISS** — a node is three fields. No classes, no inheritance, no
  framework-y base types.
- **DRY** — `Descriptor<Kind, Data>` is *the* node type used by every package;
  nothing duplicates "identity + kind + data".
- **SOLID** — single responsibility per module (`constants`, `descriptor`,
  `registry`); `descriptor` depends on `registry` only through the guarded
  `register` call.
- **Clean** — nodes are frozen; the registry is the only mutation point;
  readers never mutate.

## Design

### File: `packages/core/src/internal/freeze.ts`

```ts
export const freeze = <T>(value: T): T => Object.freeze(value);

export const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
};
```

### File: `packages/core/src/registry.ts`

```ts
import type { Descriptor, RelationshipDescriptor } from "./descriptor.js";

type RegistryMap = Map<string, Descriptor<string, unknown>>;

const getRegistry = (): RegistryMap => {
  const g = globalThis as typeof globalThis & { globalRegistry?: RegistryMap };
  return (g.globalRegistry ??= new Map());
};

export function register(descriptor: Descriptor<string, unknown>): void {
  const registry = getRegistry();
  if (registry.has(descriptor.__key)) {
    throw new Error(
      `Duplicate descriptor key '${descriptor.__key}' (kind '${descriptor.__kind}').`,
    );
  }
  registry.set(descriptor.__key, descriptor);
}

export function lookup(key: string): Descriptor<string, unknown> | undefined {
  return getRegistry().get(key);
}

export function lookupAll(
  kind: string,
): readonly Descriptor<string, unknown>[] {
  return [...getRegistry().values()].filter((d) => d.__kind === kind);
}

export function relationships(): readonly RelationshipDescriptor[] {
  return [...getRegistry().values()].filter(
    (d): d is RelationshipDescriptor => d.__kind === "relationship",
  );
}

export function clear(): void {
  getRegistry().clear();
}
```

Key points:

- `getRegistry()` lazily creates `globalThis.globalRegistry` on first use.
  The CLI may also pre-seed it (as `bundle.js` does); `??=` is idempotent
  either way.
- `register` rejects duplicate keys. Keys are globally unique across the whole
  application (all modules, all packages) — the contract that makes traversal
  and validation reliable.
- `relationships()` is added now (it filters by `__kind === "relationship"`)
  even though relationship descriptors are created in slice
  `04_core_relationship_edges`; the query is the CLI's main read path.
- These registry functions are **collect-mode only**. In runtime mode the
  bundle never references them, so esbuild tree-shakes them (slice
  `13_tree_shaking_bundle_test` proves it).

### File: `packages/core/src/descriptor.ts`

```ts
import { allowGlobalRegistry } from "./constants.js";
import { freeze } from "./internal/freeze.js";
import { register } from "./registry.js";

export interface Descriptor<Kind extends string, Data> {
  readonly __kind: Kind;
  readonly __key: string;
  readonly data: Data;
}

export function defineDescriptor<Kind extends string, Data>(
  kind: Kind,
  key: string,
  data: Data,
): Descriptor<Kind, Data> {
  const descriptor = freeze({ __kind: kind, __key: key, data });
  if (allowGlobalRegistry) register(descriptor);
  return descriptor;
}
```

Behavior:

- `freeze` makes every node deeply-consistent (shallow freeze on the shell;
  `data` is the caller's responsibility until `finalize` in slice
  `06_core_public_api`, but every framework-created `data` is frozen at the
  point of creation).
- `if (allowGlobalRegistry) register(...)` is the guarded collect step. In
  runtime mode this line and the entire `register`/`getRegistry` code vanish
  from the bundle.
- `defineDescriptor` **always** returns the descriptor — the executor path
  never depends on the registry.

## Implementation steps

1. Create `packages/core/src/internal/freeze.ts`.
2. Create `packages/core/src/registry.ts`.
3. Create `packages/core/src/descriptor.ts`.
4. Wire exports in `packages/core/src/index.ts`:

   ```ts
   export { allowGlobalRegistry } from "./constants.js";
   export type { Descriptor } from "./descriptor.js";
   export { defineDescriptor } from "./descriptor.js";
   export { clear, lookup, lookupAll, register, relationships } from "./registry.js";
   ```

5. `yarn build` must produce `packages/core/dist` with matching `.d.ts`.

## Edge cases & error handling

- **Duplicate keys** are a hard error (not silently overwritten): the message
  includes the key and kind for fast diagnosis. The CLI's collect mode will
  surface these; so will unit tests.
- **Key collisions across modules**: because keys are global, route keys are
  composite (`"GET /users/:id"`), aggregate/handler keys use their `name`, and
  relationship keys are auto-composite (slice 04). Documented convention, no
  magic prefix.
- **`data` immutability**: consumers must not mutate `descriptor.data` after
  creation; builders that refine use a dedicated helper (slice
  `06_core_public_api`, `refine`).
- **Multiple apps in one process**: `clear()` exists for tests and for the CLI
  to start a fresh compilation; it is the only intentional reset.

## Verification

```bash
yarn build
yarn test
```

Unit checks added in slice `07_core_registrar_tests` will lock: node shape,
frozen node, registration into the global, duplicate-key throw, `lookup`,
`lookupAll`, `relationships`, `clear` isolation.

Definition of done:

- `defineDescriptor(kind, key, data)` returns `Descriptor` and (in collect
  mode) stores it in `globalThis.globalRegistry`.
- `yarn build` emits `dist/index.d.ts` exposing the types above.

## Dependencies / prerequisites

- Slice `01_bootstrap_workspace` (package scaffolding, Vitest alias to src).
- Slice `02_core_compile_time_flag` (`allowGlobalRegistry`).

## Notes / open questions

- `register` throwing on duplicates is deliberate; a future CLI may decide to
  aggregate *reports* of duplicates instead of throwing. YAGNI for now.
- The registry is intentionally a plain `Map` (per `bundle.js`), not a class
  with hidden behavior. If richer queries appear (incoming edges, full graph
  build), they become functions in this module, not methods on a class.
