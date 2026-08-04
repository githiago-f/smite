---
title: Example
summary: A runnable app that wires env values into an HTTP server.
order: 99
---

`examples/env-http` shows `@smitejs/env` in a complete server: `PORT` and
`GREETING` are declared, resolved through a provider reading `process.env`, and
injected into an `@smitejs/http` handler. Start it with
`yarn workspace @smitejs/example-env-http start`.