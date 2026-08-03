---
title: Edges and child indexes
summary: Connecting nodes with relate and walking them with childrenOf.
order: 20
---

A descriptor alone is an isolated node. Smite's IR becomes a graph when nodes
are joined by edges. `relate(from, relation, to)` creates a
`RelationshipDescriptor` edge and attaches `to` to a runtime child index on
`from`.

## The relationship edge

The edge carries the composite key `"<from.__key>-><relation>-><to.__key>"` and
`data` with `from`, `to`, and `relation`. Like all nodes, it is frozen. The
registry records it, and `relationships()` lists every edge collected at build
time.

## The runtime child index

Relating also attaches a non-enumerable `children` map to the parent. It is a
plain `Map` from relation to child descriptors, hidden from `Object.keys` so a
descriptor still looks like the plain value it is. Executors read it at runtime
— they never need the registry, they just walk child references.

@example Relate nodes and walk children

## Walking the graph

`childrenOf(from, relation?)` reads that index. With a relation it returns the
children connected by that relation; without one it flattens every relation.
A node with no edges returns `[]`. Duplicate relations throw, and cycles are
tolerated (the finalizer visits each node at most once).

## Why this matters

The child index is the boundary between build time and runtime. At build time
the registry is the whole-picture view; at runtime the index is the
per-parent view executors traverse. Both are built by the same `relate` call,
so there is exactly one source of truth for structure.