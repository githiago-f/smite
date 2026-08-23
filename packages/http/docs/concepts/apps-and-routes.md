---
title: Apps and routes
summary: Building an HTTP application with http.app and http.route.
order: 10
---

`@smitejs/http` is a declarative DSL for describing an HTTP API. You describe
routes and handlers; the DSL takes care of turning that description into a
serving application.

## The app

`http.app(name?)` creates an app and returns a reference carrying `use()` and
`serve()`. Everything hangs off that one reference: inject routers (and aspects)
with `app.use(...)`, and call `app.serve()` (or `serve(app)`) when you are ready
to handle requests.

@example Define an app with routes

## The route

`http.router()` creates a standalone route reference, carrying `input`, `accept`,
and per-method shortcuts. Routes are where shared shape lives: a route can
declare per-bucket input validation that all of its endpoints inherit, then fan
out into multiple method + path endpoints. Routes are inert until injected:
`app.use(routes)` writes their endpoints into the app's IR, so a router can be
declared anywhere and attached to an app later.

@example Declare routes with methods

## One value, many consumers

The app you build is a plain value you can hand to different consumers: `serve`
turns it into a request handler, the client generator reads it to emit a typed
client, and future tooling can walk it the same way — no special plumbing
required.
