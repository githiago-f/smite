---
title: Usecases
summary: Named operations that own the rules and return a Result.
order: 50
---

A usecase is a named operation that turns an input into a `Result`. It is the
single place a business rule lives in the request path: it validates the input,
checks the specifications that govern the operation, calls the injected ports,
and hands back a success value or a reason — never a thrown error.

`domain.usecase({ name, input, deps, handle })` builds one:

- `input` is a zod schema; invalid input short-circuits to a `domain.validation`
  failure instead of reaching your logic.
- `deps` lists the ports the operation needs; a missing dependency fails fast
  with `domain.deps` rather than exploding later.
- `handle(deps, input)` is the functional core. It returns a `Result` and does
  all I/O through the injected ports.

`usecase.run(input, deps)` returns a `TaskResult` (a lazy, composable `Result`).
`usecase.with(deps)` closes over the dependencies so you can hand a pure
`(input) => TaskResult` to a transport.

The rule is one way in, one way out: validate, check, act, respond. Everything a
usecase does is visible in its body, which is exactly what makes it auditable.

@example Define a usecase
@example Bind dependencies to a usecase