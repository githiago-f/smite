---
title: Middleware and request logging
summary: Composing a request pipeline with app.use, and tracing requests with a request-scoped pino logger.
order: 65
---

A route describes *what* to serve; aspects describe *how*. `app.use(...)`
injects named pipeline stages into the app: log, authenticate, rate-limit,
inject shared state — without touching any handler.

## The pipeline

`app.use` accepts **aspects** built with the `aspect` factory, plus routers.
Middleware are stages `(ctx, next) => response`. Calling `next()` continues
the pipeline into the next stage and eventually the matched route handler;
returning early short-circuits it. Order matters: `app.use(a, b)` runs `a`,
then `b`, then the handler, unwinding back through each `next()`.

The pipeline composes four kinds of aspect in registration order:
`aspect.middleware` and `aspect.interceptor` wrap the chain,
`aspect.guard` gates it (return a response to short-circuit before the
handler), and `aspect.filter` post-processes the handler's response.

@example Apply AOP aspects

Each stage reads `ctx.scope`, the request-scoped shared context carried by
`runWithScope` from `@smitejs/core`. Because that context is streamed by an
`AsyncLocalStorage` from the same store, your handlers and deep-called code
stay in sync with the request — no passing a `ctx` around by hand.

## A request-scoped logger

`requestLogger()` is a ready-made middleware aspect backed by `pino`. When a
request arrives it builds a logger *from the request context*, pins it onto the
scope so the rest of the call stack can use it, and logs the request completion
with status and duration.

@example Log every request

Inside a handler, or anywhere deeper in the stack, read the same logger with
`currentLogger()` — it returns the pino instance for the present request, so
your logs are keyed to that request without threading a logger through.

## Traits and separate config

Objects you stash on `ctx.scope` (a logger, a tracer, a user session) are
visible to everything that runs during that request. Add your own middleware to
populate traits; later stages read them via `currentScope()` the same way the
logger is read. The scope is wiped between requests, so nothing leaks across.