---
title: Endpoints and handlers
summary: Mapping methods and paths to response functions.
order: 30
---

A route declares shape; endpoints declare reachability. `accept(method, path)`
declares an endpoint for a method + path pair, then `.handler(fn)` wires the
function that answers it.

## Accepting requests

`route.accept(HttpMethod.GET, "/users/:id")` declares an endpoint. Paths use
the `:param` syntax; at serve time the param values are extracted and placed on
the context. `ANY` is a wildcard method that matches every verb.

@example Add endpoints and handlers

## The handler

The handler is a plain function receiving a typed context — `request`, plus the
validated `params`, `query`, `headers`, and `body` — and returns a response
value (or a promise of one). There is no framework class, no `this`, and no
hidden behavior: the handler is just the function you wrote.

## One handler per endpoint

Each endpoint carries exactly one handler; calling `.handler` again replaces the
endpoint's handler (last one wins). Keep endpoints atomic — one method + path,
one handler.