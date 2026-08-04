---
title: Ports and the functional core
summary: Make I/O explicit so the logic stays pure and testable.
order: 40
---

The functional core / ports pattern keeps business logic pure by moving every
side effect — a database, a queue, an API client — behind a *port*. The port
describes a capability; the usecase depends on the shape, not on any specific
implementation.

`domain.port({ name, methods })` declares a contract:

@example Declare a repository port

A working store implements that shape and is injected at the edge:

- The usecase does not construct or import the store — it receives the
  implementation through its `deps`.
- Swapping the in-memory Map for a real database changes the wiring, not the
  usecase code.
- Emitting the tests inject a fake store, exercising every rule without a
  running service.

`Repository` / `ReadPort` / `WritePort` give you the standard read/write shapes
when your aggregate fits the default: `findById`, `save`, `add`, `update`,
`remove`. For anything richer, declare a custom port.

@example Bind dependencies to a usecase