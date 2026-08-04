---
title: Descriptor nodes
summary: How an application is modelled as typed, frozen nodes in the IR.
order: 10
---

Everything in Smite's intermediate representation (IR) is a descriptor: a plain
object with three fields — `__kind`, `__key`, and `data`. `__kind` is a string
that says what the node *is* (`"http.route"`, `"app"`, `"relationship"`, ...);
`__key` is a unique composite identifier; `data` is a frozen snapshot of the
node's payload.

## When you notice one

You almost never construct a descriptor by hand. `defineDescriptor` is the
single creator, and builders such as `@smitejs/http` call it for you. The same
function is also the primitive the whole framework reduces to.

@example Define and look up a descriptor

## Identity and immutability

Two descriptors are the same descriptor iff they are the same object. `data` is
frozen at creation via `Object.freeze`, so a node can never silently drift. To
change a node's payload you replace it wholesale with `refine` (see the
immutability concept); you do not mutate `data` in place.

## Kinds and keys

`__kind` is free-form but conventionally namespaced with a dot, e.g. `app`,
`http.route`, `http.endpoint`, `http.handler`, `relationship`. `__key` must be
unique within the process because it is the global registry key. Composite keys
(such as `"GET /users/:id"`) keep the registry small and collision-resistant.

## Next

- Edges — how nodes are connected (`relate`)
- The registry — where nodes are collected at build time
- Immutability — freezing and the `refine`/`finalizeDescriptor` lifecycle