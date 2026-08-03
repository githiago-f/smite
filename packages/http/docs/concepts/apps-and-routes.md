---
title: Apps and routes
summary: Building an HTTP application with http.app and http.route.
order: 10
---

`@smite/http` is a declarative DSL for describing an HTTP API. You describe
routes and handlers; the DSL takes care of turning that description into a
serving application.

## The app

`http.app(name?)` creates an app and returns a reference carrying `route()` and
`serve()`. Everything hangs off that one reference: pass it to `http.route(app)`
to add routes, and to `app.serve()` (or `serve(app)`) when you are ready to
handle requests.

@example Define an app with routes

## The route

`http.route(app)` attaches a route to the app and returns its reference,
carrying `req` and `accept`. Routes are where shared shape lives: a route can
declare per-bucket input validation that all of its endpoints inherit, then fan
out into multiple method + path endpoints.

## One value, many consumers

The app you build is a plain value you can hand to different consumers: `serve`
turns it into a request handler, the client generator reads it to emit a typed
client, and future tooling can walk it the same way — no special plumbing
required.
