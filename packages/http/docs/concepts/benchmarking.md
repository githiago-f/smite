---
title: Benchmarking routing
summary: Comparing serve()'s request handling to Express and Fastify with k6.
order: 60
---

`serve()` returns a plain `(request) => Promise<response>` function, so the
dispatch cost is measurable head-to-head against other routers. The benchmark
runs the identical routes in Smite, Express, and Fastify, loads each with k6 at
a fixed arrival rate, and compares achieved requests/sec and latency.

## What's measured

Each server answers the same routes:

- `GET /`
- `GET /users`
- `GET /users/:id`
- `GET /users/:id/posts/:postId`

k6 runs the four-route mix for 30s with a fixed arrival rate and records
`http_req_duration` (p50/p90/p95/p99) plus achieved `requests/s`.

## Running it

`yarn bench:http` builds the three server containers (Docker), launches them,
runs k6 against each, and writes `benchmarks/results/*.summary.json`. The Smite
server is bundled in production mode, so the measured handler is the exact
shape your app ships. Re-run `yarn docs:build` afterward to render the fresh
numbers.

@benchmark

## Caveats

- This measures the routing + dispatch path only — no database, middleware, or
  serialization beyond `JSON.stringify`.
- Different machines produce different absolute numbers; read the *ratios*.
- The harness lives in `benchmarks/` alongside the example apps it uses.