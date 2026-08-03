---
title: Matcher
summary: Fluent exhaustive branching over Result.
order: 50
---

`Matcher.from(result)` is a fluent, exhaustively-typed way to branch on a
`Result`. Instead of `if`/`else`, you describe both branches and run.

## Using it

`Matcher.from(result).ok(okHandler).err(errHandler).run()` — the handlers run
on the corresponding track, and the result type is the union of both branch
outputs. Handlers are optional until `run()`; running without the branch that
is active throws, catching incomplete branches early.

@example Match result values

## Why it exists

A `Result` is a value, and this is the value's dispatch table. It reads clearly
for endpoints and decisions, and the types make "did I handle the error track?"
a compile-time question rather than a runtime surprise.