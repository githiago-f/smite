---
title: The app junction
summary: createApp roots the graph so executors and tooling know where to start.
order: 40
---

Every graph needs a root. In Smite that root is an `app` descriptor created by
`createApp(name?)`. It is a plain node with `kind: "app"`, and its `__key` is the
app name (or `"app"` when unnamed).

## One app by default

Because registry keys are unique, an unnamed app collides with a second unnamed
app. In the common case there is exactly one application per entry, and its
registry key is simply `"app"`. Name it when multiple apps could coexist in one
module graph.

@example Create an app junction

## Why a root matters

Executors need a place to begin traversing the child index. `serve(app)`,
client generation, and the future compiler all start at the app junction and
walk `childrenOf(app, ...)`. `lookupAll("app")` is how tooling asks "what
applications exist here?".

## Bootstrap pattern

The `@smite/http` DSL wraps this: `http.app()` calls `createApp` and returns a
reference that *is* the app descriptor, carrying the route builder and `serve`.
Handing the app to executors such as `serve` and the compiler takes the
reference directly — there is no separate `.descriptor` to unwrap.