---
title: Task and TaskResult
summary: Lazy asynchronous work, with and without failure.
order: 60
---

`Task<Value>` is a lazy async computation: it captures work that does not start
until you call `run()`. `TaskResult<Value, Error>` is the same idea but resolves
to a `Result`, so asynchronous failure is modelled as a value instead of a
rejected promise.

## Task — lazy async

`Task.from(fn)` captures an async operation without running it. `.map`,
`.flatMap`, and `.tap` build a pipeline; nothing executes until `.run()`
resolves. This is how you defer I/O until the caller asks for it.

@example Task lazy async work

## TaskResult — async with failure

`TaskResult.from(fn, mapError)` wraps a possibly-throwing async operation.
`.map`/`.flatMap` compose successes and short-circuit failures, `.recover`
turns a failure into a success, and `.run()` resolves to a `Result` — so `try`
does not have to live in your handler, only in your pipeline.

@example TaskResult async failure pipeline

## Constructing

- `TaskResult.ok(value)` / `TaskResult.err(error)` — lift plain values.
- `TaskResult.fromResult(result)` — lift an existing `Result`.
- `TaskResult.from(fn, mapError)` — capture async work, mapping thrown errors.