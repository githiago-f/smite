---
title: The global registry
summary: The build-time view of the whole application.
order: 30
---

The global registry is a single `Map` living on `globalThis.globalRegistry`
that holds every node and edge created in collect mode. It is the build-time
window into an application: tooling reads it after the app module has run to
discover what was declared.

## Collect mode only

Registration is gated by the compile-time constant `ALLOW_GLOBAL_REGISTRY`.
When esbuild defines it as `"true"`, `defineDescriptor` and `relate` insert
their results into the registry. When it folds to `false` (the production
default), the registry code becomes unreachable and is dropped from the bundle.
This is why executors never import the registry.

## Reading the registry

- `lookup(key)` — one descriptor by composite key.
- `lookupAll(kind)` — every descriptor of a given kind.
- `relationships()` — every relationship edge.
- `clear()` — empty the registry (used between test cases and compilations).

@example Query and clear the registry

## Collisions

Keys are unique. Registering the same key twice throws, which catches duplicate
route declarations and duplicate app junctions early rather than silently
overwriting.

## Next

- The junction — the `app` node that roots the graph
- Tree-shaking — what survives when the registry is folded away