---
title: Registration
summary: Declaring which variables a scope needs and how they validate.
order: 20
---

`env.register(specs)` is the declaration step: a map of name to a
`{ key, validation }` pair. This is where you answer "what does this scope
require, and what shape is acceptable?" — exactly once, in one place. It returns
a builder you finish with `withProvider`.

## The spec is the contract

Each entry has two parts:

- `key` — the raw provider key, i.e. the `process.env` variable name the
  provider is asked for (`"DATABASE_URL"`).
- `validation` — the zod schema driving everything: type coercion, optionality,
  defaults, and error messages.

The declared name is the property you read on the instance (`databaseUrl`), and
the zod schema is also the type source — `await appEnv.databaseUrl` has the
inferred type.

@example Declare and resolve an env var

## Required, optional, defaulted

- `z.string()` — the variable must be present and a string.
- `z.string().optional()` — a missing variable resolves to `undefined`.
- `z.coerce.number().default(3000)` — missing variables fall back to the
  default; strings like `"8080"` are coerced to numbers.

@example Coerce and default env values

## Build-time manifest

Each declared name is also recorded in a build-time manifest. The future CLI
uses it to scaffold `.env.example` files and to fail the build on missing
required variables at compile time instead of at boot.
