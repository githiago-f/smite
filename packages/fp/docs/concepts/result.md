---
title: Result
summary: Success or failure, composed and recovered without throwing.
order: 40
---

`Result<Value, Error>` is the workhorse error type: `ok(value)` or `err(error)`.
It lets handlers be explicit about failure without exception-driven control
flow, and it is the type Smite executors hand back so failures are values you
can branch on.

## Constructing

- `Result.ok(value)` — success.
- `Result.err(error)` — failure carrying an error value.
- `Result.err(tag, data)` — a structured error with a discriminant tag.
- `Result.fromThrowable(fn, mapError)` — capture a throwing operation as a
  `Result`, optionally mapping the thrown error.

## Composing

`.map` and `.flatMap` transform success and short-circuit failure. `.mapErr`
and `tapErr` work the failure track. `.tap` runs a side effect on success
without changing the value.

## Recovering

`.recover(fn)` converts a failure into a success by deriving a value from the
error. `.unwrapOr(fallback)` collapses to the value or the fallback;
`.unwrapOrElse(fn)` defers the fallback until needed.

@example Result success pipeline

## Branching

`.match(ok, err)` exhaustively branches on both tracks — the mature form of a
`try`/`catch` that the compiler can see. See the Matcher concept for the fluent
variant.