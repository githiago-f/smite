---
title: Example
summary: A runnable app that wires env values into an HTTP server.
order: 99
---

`examples/env-http` shows `@smite/env` in a complete server: `PORT` and
`GREETING` are declared, resolved through a provider reading `process.env`, and
injected into an `@smite/http` handler. Start it with
`yarn workspace @smite/example-env-http start`.