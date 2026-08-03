---
title: Example
summary: A server plus a generated typed client that calls it.
order: 99
---

`examples/typed-client` is the codegen flow end to end: an app definition, a
generated builder client from `@smite/client`, and a call-site that hits the
live server. Start it with `yarn workspace @smite/example-typed-client build`,
then `start:server` and `start:client`.