---
title: Providers
summary: Where raw environment values come from.
order: 10
---

`@smitejs/env` does not read `process.env` directly. It reads through a provider:
a single function `(key) => Promise<raw>` that you attach to a built instance
with `withProvider`. This indirection is what makes the library testable,
portable, and declarative.

## Attaching a provider

The provider is a plain function. For Node it is usually a thin wrapper over
`process.env`; for a test it is a fixed map; for a cloud runtime it could pull
from a secrets store. Attach it when you build the instance:

@example Declare and resolve an env var

## Always async

Providers are always async: the signature is `(key) => Promise<unknown>`, and
the resolution layer awaits every provider. There is no sync/async split to
reason about — sync sources just return `Promise.resolve(value)` (or an `async`
function), and async sources like secrets vaults flow through the same path.

## Per-instance wiring

The provider is captured when you call `withProvider`, and each instance keeps
its own. Two instances built from the same declarations can read from different
sources (real `process.env` here, a fixture map there) without sharing state.
