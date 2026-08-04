---
title: Local server over node:http
summary: Running an app on the wire with the built-in node server adapter.
order: 60
---

`serveNode(app)` turns a declared app into a ready `node:http` server. It is
the transport the `@smitejs/cli` dev server uses, and the same helper a
scaffolded `src/server.ts` can call for production.

## What serveNode does

1. Parses each `IncomingMessage` into an `HttpRequest`: URL and query string,
   headers, cookies, and a JSON body for `POST`/`PUT`/`PATCH`.
2. Dispatches through the app's `serve()` router.
3. Writes the returned `HttpResponse` (status, content type, stringified body).

The returned server is not yet listening, so callers compose their own
`.listen(port, host, onListen)` — easy to customise the host, port, and start
log.

## Mounting routers

Pass `docs` to mount extra routers at exact paths ahead of the app's routes, e.g.
`serveNode(app, { docs: { router: swaggerUi({ doc, title }), paths: ["/docs", "/openapi.json"] } })`.

## Extending the transport

`transformRequest` lets you adjust the parsed request before dispatch, so a
custom content type, an auth header, or a rewritten path can be handled in one
place.

@example Serve an app over node:http

## Where it lives

`serveNode` is the only part of `@smitejs/http` that touches Node — `serve()`
itself stays platform-free. The adapter is intentionally small so it can be
wrapped, substituted, or composed with other `node:http` handlers.
