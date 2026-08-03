---
title: Option
summary: Modelling optional values without null checks.
order: 20
---

`Option<Value>` represents a value that may or may not be present. It is `some`
(a present value) or `none` (absent), and it removes `if (value != null)`
branching from your pipelines by carrying the check inside the API.

## Constructing

- `Option.some(value)` — an explicit present value.
- `Option.none()` — an explicit absence.
- `Option.fromNullable(value)` — maps `null`/`undefined` to `none`, anything
  else to `some`. This is the usual entry point.

## Transforming

`.map`, `.flatMap`, and `.filter` operate only on present values and short-
circuit on `none`. `.tap` runs a side effect only when present and returns the
same option.

## Reading

`.isSome()` / `.isNone()` branch explicitly. `.unwrapOr(fallback)` returns the
value or the fallback, and `.unwrapOrElse(fn)` defers computing the fallback
until it is needed.

@example Option optional values