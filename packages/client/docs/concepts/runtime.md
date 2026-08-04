---
title: The client runtime
summary: configure and request — the fetch layer behind every call.
order: 30
---

Every generated call funnels through `request(method, path, input)` in
`@smitejs/client/runtime`. The runtime is a small fetch layer: it interpolates
path params, serializes query and body, performs the request, and parses the
response. Just HTTP — no server package, no framework, no magic.

## Configuring defaults

`configure({ baseUrl, fetch })` sets module-level defaults. `baseUrl` is
prepended to every path; `fetch` lets you swap the transport (tests, edge
runtimes). Per-call `$config` overrides these defaults.

@example Configure the client runtime

## Making a request

`request(method, path, input?)` is the primitive the generated builders call.
Path params are filled into the template, query values become a query string
(arrays become repeated params), and object bodies are JSON-serialized with
`content-type: application/json`.

@example Make a typed request

## Response handling

The body is parsed as JSON when possible, falling back to raw text. The
response is normalized to `{ status, body, headers }`, and non-2xx statuses are
returned rather than thrown — mirroring the server's `serve` contract.