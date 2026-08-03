---
title: Either
summary: Two-track values for two-outcome computations.
order: 30
---

`Either<Left, Right>` models a computation with two possible outcomes. Unlike
`Option` (present/absent) it carries a value on both tracks: `left` and
`right`. Use it when both outcomes carry meaning — a parsed value versus a
parse error, an allowed versus a denied decision.

## Constructing

- `Either.left(value)` / `Either.right(value)` — build either track.
- `Either.fromNullable`-style helpers are not provided; construct explicitly.

## Transforming

`.map` transforms a right value, leaving a left untouched. `.flatMap` chains
another two-track computation. `.mapLeft` transforms the left track, and
`.unwrapOr(fallback)` collapses to the right value or the fallback.

@example Either two-track values

## Track symmetry

Both tracks are first-class: you can map the failure path with the same
comfort as the success path, which keeps error handling visible instead of
punished.