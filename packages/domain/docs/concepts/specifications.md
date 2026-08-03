---
title: Specifications
summary: Named business rules that return a reason when they fail.
order: 30
---

A specification is a named rule over a value. Unlike a bare boolean predicate, it
returns a `Result`, so a failed rule explains *why*: a cart has a limit, an
order can only be placed once, a customer must be active.

`domain.specification({ name, predicate })` returns a rule object with:

- `isSatisfiedBy(input)` — `Result.ok(true)` when the rule holds, or
  `Result.err(tag, data)` carrying a discriminant and details when it does not.
- `and(...others)` / `or(...others)` / `not()` — combinators that build *new*
  specifications and never mutate the original, so rules stay open/closed.

When several rules must all hold, `mergeSpecifications(...)` combines them and
short-circuits at the first failure.

Compose rules into a readable language of policies, then route them from
usecases so the "why not" flows out to the caller as data, not a stack trace.

@example Compose specifications