---
title: Predicates
summary: Composable type guards and truth checks.
order: 70
---

Predicates are `(value) => boolean` checks that compose with `and`, `or`, and
`not`. Smite ships a few guards (`isString`, `isNumber`, `isUUID`, `isEmpty`)
and the combinators to build your own.

## Combinators

- `and(...predicates)` — every predicate must pass.
- `or(...predicates)` — at least one must pass.
- `not(predicate)` — negate a predicate.

## Built-in guards

`isString`, `isNumber` (rejects `NaN`), `isUUID`, and `isEmpty` (empty string,
array, map, set, or keyless object) cover the common checks. Guards are type
predicates, so narrowing flows to the rest of your code.

@example Predicate composition

## Where they fit

Use predicates where a decision is a pure function: route guards, input
checks, and `Option.filter` callbacks. Because they are plain functions they
compose with the rest of the fp toolkit without ceremony.