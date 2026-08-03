---
title: Immutability and lifecycle
summary: refine grows a node; finalizeDescriptor seals the graph.
order: 50
---

Smite's IR is immutable by construction. Descriptor `data` is frozen at
creation, and the graph is progressively sealed until, at runtime, the whole
reachable subtree is deeply frozen. Two functions drive this lifecycle.

## refine — update data, keep identity

`refine(descriptor, patch)` shallow-merges `patch` into the node's `data` and
replaces it with a fresh frozen snapshot. The node keeps its `__kind`, `__key`,
and object identity, so references held by edges and the registry stay valid.
Use it to attach metadata late, such as `http.route` attaching its `req`
validation config.

@example Refine descriptor data

## finalizeDescriptor — seal the graph

`finalizeDescriptor(root)` deep-freezes the root, its `data`, its child index,
and every reachable node — recursively and cycle-safely. After this the graph
is a read-only value: any further `refine` throws a `TypeError`.

@example Finalize the descriptor graph

## Lifecycle summary

- Build phase: `defineDescriptor` → `relate` → `refine` (mutable, registry-backed).
- Runtime phase: `finalizeDescriptor` (frozen, registry-free).

Executors call `finalizeDescriptor` for you — `serve(app)` does it before the
first dispatch, so handlers can rely on the graph being stable.