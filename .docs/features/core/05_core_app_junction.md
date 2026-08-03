# 05. App Junction (`createApp`)

## Goal

Provide the transport-agnostic **application junction**: a single root node
(`kind: "app"`) under which routes, jobs, messaging consumers, and RPC
endpoints hang. `@smite/http`'s `http.app()` is a thin wrapper over this core
primitive (slice `08_http_app_and_route`).

## Context

The core sketch describes the `App` as:

```
// a primitive that describes a junction of
// API endpoints
// Schedule jobs
// Messaging endpoints
// RPC endpoints
```

The old project's analog was `moduleBuilder(name)` with `byKind` groupings. We
simplify: an app is just a descriptor node; its children are added via
`relate(app, "<relation>", child)`. The junction has no per-transport logic —
it is a container with a name.

## Harness alignment

- **KISS** — `createApp(name?)` is one function returning one node. No
  application class, no builder, no lifecycle.
- **DRY** — the junction concept lives once in core; http, scheduler,
  messaging, and rpc all reuse it.
- **SOLID** — Dependency Inversion: core defines the `App` contract; transports
  depend on core, never the reverse. The core never imports `http` (no cycles).
- **Clean** — an app node is plain data (`__kind`, `__key`, `data: { name }`),
  serializable and analyzable.

## Design

### File: `packages/core/src/app.ts`

```ts
import type { Descriptor } from "./descriptor.js";
import { defineDescriptor } from "./descriptor.js";

export interface AppDescriptor extends Descriptor<"app", { name?: string }> {}

export function createApp(name?: string): AppDescriptor {
  return defineDescriptor("app", name ?? "app", {
    ...(name !== undefined ? { name } : {}),
  });
}
```

### Key semantics

- **Kind**: `"app"`.
- **Key**: the supplied `name`, or `"app"` when unnamed. Duplicate detection
  (slice 03) means a second unnamed app throws — an acceptable guard for the
  common single-application artifact. Multiple apps must be named.
- **Data**: `{ name? }` — kept minimal (KISS). Transport-specific metadata
  belongs on children, not on the junction.
- **Children**: added by callers with `relate(app, "<relation>", child)`.
  The http package uses `"http.route"`; a future scheduler uses
  `"scheduler.job"`; messaging uses `"messaging.consumer"`; rpc uses
  `"rpc.endpoint"`. Relation names are the *open* extension point.

### Where `addChild` went

Earlier sketches proposed an `addChild` helper. It was dropped (DRY): it is
literally `relate` with a better name. Transports call `relate` directly; if a
transport wants a domain-flavored name it can alias it itself.

## Implementation steps

1. Create `packages/core/src/app.ts`.
2. Export from `packages/core/src/index.ts`:

   ```ts
   export { createApp } from "./app.js";
   export type { AppDescriptor } from "./app.js";
   ```

3. `yarn build` + `yarn test`.

## Edge cases & error handling

- **Unnamed duplicate app**: second `createApp()` without a name throws a
  duplicate-key error (documented behavior, message from slice 03). Tests
  assert this.
- **Empty app**: an app with no children is valid; `serve()` on it (slice
  `11_http_serve`) returns a router that answers `404` for everything.
- **App as a child of an app**: allowed by the primitives (an edge can point
  at any node). If nesting becomes a real need, the CLI validation layer will
  decide; core does not restrict it (KISS).

## Verification

```bash
yarn build
yarn test
```

Assertions locked in slice `07_core_registrar_tests`:

- `createApp("api").__kind === "app"`, `__key === "api"`, `data.name === "api"`.
- `createApp()` yields key `"app"`.
- Adding a child via `relate(app, "http.route", route)` is visible through
  `childrenOf(app, "http.route")` and the `"relationship"` descriptors.

Definition of done:

- `createApp` exports a junction node compatible with the sketch's `App`
  concept, with no http knowledge in core.

## Dependencies / prerequisites

- Slice `03_core_node_and_registry` (`defineDescriptor`, `Descriptor`).
- Slice `04_core_relationship_edges` (`relate` used by transports).

## Notes / open questions

- A future CLI may want an app descriptor to *require* a name (for artifact
  naming). That is a CLI-level validation, not a core constraint.
- The junction could later carry declared transports (e.g.
  `data.transports: ["http"]`) for CLI inference; YAGNI until the compiler
  asks for it.
