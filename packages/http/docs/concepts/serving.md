---
title: Serving requests
summary: Turning an app into a plain request handler.
order: 50
---

`serve(app)` turns a declared app into an `HttpRouter`: a plain
`(request) => Promise<response>` function you can hand to any HTTP server or
async handler.

## What serve does

1. Freezes the app into a stable, read-only structure, so dispatch never sees a
   half-built declaration.
2. Builds path matchers from every endpoint under the app's route.
3. Each request is matched by path then method, validated against the route's
   declared schemas, and dispatched to the endpoint's handler.

@example Serve a request

## Dispatch rules

- The route's `req` schemas are validated per request; failure yields `400`.
- An unmatched path or method yields `404` with `{ error: "Not Found" }`.
- An endpoint with no handler also yields `404`.
- `ANY` endpoints match every method; otherwise the method must match exactly.

## Bringing it to the wire

`HttpRouter` is intentionally free of any Node or platform dependency — it
takes an `HttpRequest` object and returns an `HttpResponse`. A tiny adapter
(an acceptable `http.createServer` handler, an edge function, a test harness)
supplies the transport. That adapter is where the real server lives; Smite
stops at the I/O boundary.