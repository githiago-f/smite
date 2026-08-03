---
title: Handler wiring
summary: How a transport relates a handler back to its usecase without a dependency.
order: 10
---

A domain handler and the transport that runs it live in different packages. So
how does `@smite/http` trace a route handback to the `domain.usecase` it runs?

The answer is a symbol handshake that avoids a package dependency entirely.

`domain.handler(usecase, deps, options)` returns a function that reads
`usecase[usecaseDescriptorSymbol]` (the non-enumerable IR node a usecase stores
on itself) and attaches it to the returned handler under
`Symbol.for("@smite/domain/handler")`. The metadata is non-enumerable, so it
never leaks through `Object.keys` into transported responses.

The domain side attaches the metadata; the transport side reads it:

@example Relate a handler to a usecase

Two things make this safe:

- The `Symbol.for` string is the contract between the packages, so neither one
  imports the other.
- The carried node is used directly — no registry `lookup` — so the production
  bundle tree-shakes exactly as if the domain glue were never there.

The result: the compiler IC with no cost at runtime.