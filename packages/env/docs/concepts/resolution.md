---
title: Resolution
summary: Reading and validating values, lazily and with caching.
order: 30
---

Reading a value is `await appEnv.port`: the instance provides one async property
for each declared name. It resolves the raw value through the provider, validates
it with the declared schema, and returns the typed result. Resolution is lazy
(the provider is not called until first read) and cached (the provider is called
once per name, not per read).

## Reading a value

`await appEnv.databaseUrl` returns the parsed value. Because the whole pipeline
is async (providers are always async), each property resolves to a promise.

@example Read optional env vars

## Failure modes

A read rejects with a descriptive error rather than returning a half-valid
value:

- Missing required value — "Missing env var 'x'."
- Invalid value — "Invalid env var 'x': <zod message>."

## Caching

The resolved promise is cached per name, so repeated reads are cheap and the
provider is shielded from being called in a hot loop. Optional and defaulted
values are cached like any other. Because the cache lives on the instance, each
scoped instance re-reads independently of the others.

## Opting out of the cache

When a value may change underneath you (secrets rotation, runtime toggles), pass
`{ cache: false }` to `withProvider` to re-read through the provider on every
access:

@example Bypass the cache