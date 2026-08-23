---
title: Scopes and shared context
summary: Propagating request context across async boundaries with runWithScope, currentScope and registerLogger.
order: 5
---

Most work in an application happens inside an execution unit — a request
handler, a job, a use case. Smite gives you a way to attach context to that
execution unit and read it from anywhere in the call stack, even across awaited
promises: the **scope**.

## What a scope is

`@smitejs/core` is ESM-first and declarative, but runtime behavior often wants a
little imperative context. A scope is the `AsyncLocalStorage` store Smite
seeds at the start of an execution unit and propagates as you await. Any code
that runs inside the unit — the handler, a middleware, a function you called
deep in the stack — can read the same context through `currentScope()`.

## Running inside a scope

Wrap the work that owns context in `runWithScope(context, fn)`. The store is
set for `fn` and every promise it awaits; when the scope resolves, the
enclosing one (if any) is restored, so nested units compose cleanly.

@example Scope a request handler

`@smitejs/http` does this for you: every request it dispatches runs inside
`runWithScope` seeded with the `HttpRequest`, so request context is visible to
your handler and to the middleware on the way in.

## How `@smitejs/http` hands you a logger for that context

`registerLogger` is the composable piece: it calls `build` with the current
scope so you can construct a request-scoped object — a logger, a tracer, a
unit-of-work handle — from the request data. Because the scope is an
`AsyncLocalStorage`, the factory sees the same context whether it is invoked
synchronously or after awaits.

@example Register a request-scoped logger

The context is **shared**: any code that runs inside the current execution
unit, however deep in the stack, can read it. See it in action with the logger
middleware in `@smitejs/http`.