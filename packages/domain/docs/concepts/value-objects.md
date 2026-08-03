---
title: Value objects
summary: Immutable, validated values compared by structure, never by reference.
order: 10
---

A value object wraps validated data that is equal to another value object when
every field matches. It is frozen at construction, so a `Money(10, "EUR")` stays
`Money(10, "EUR")` no matter where it travels.

`domain.valueObject({ name, schema })` returns a factory with:

- `create(input)` — validates with zod and returns a `Result`: `ok` with the
  frozen value object, or `err` carrying a `domain.validation` failure. It never
  throws for bad input.
- `parse(input)` — the strict variant that throws instead of returning a
  `Result`, for code paths that can assume valid input.
- `equals(other)` / `hash()` — structural equality and a stable string hash,
  the two things that make a value object safe to use as a key or in a set.

Reach for value objects for anything that has structure and rules: money,
addresses, order ids, percentages. They remove an entire class of "which string
is normalized?" bugs by construction.

@example Create value objects
