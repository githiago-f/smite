---
title: Express Benchmark
summary: Load-test the Express runtime vs plain Express with k6 and Docker.
order: 20
---

The Express runtime adapter mounts Smite controllers as Express routers so the core pipeline can execute HTTP intent. This concept documents how the bridge is benchmarked against a plain Express application with identical behavior. Measurement is delegated to k6 running as a separate service - the framework itself never times requests.

## Setup

The `benchmarks/` directory at the repository root owns the whole setup:

- `Dockerfile` - builds the example image from the monorepo (installs workspaces, runs `tsc -b`).
- `docker-compose.yml` - runs the image as two server containers and one k6 service.
- `k6/script.js` - the shared load-test script.
- `scripts/compare.mjs` - renders a side-by-side table from the summaries k6 produced.
- `results/` - k6 output (gitignored).

The two server containers are `express` and `smite`:

- `express` runs `examples/http/dist/express-server.js` - the plain Express application.
- `smite` runs `examples/http/dist/server.js` - the same endpoints mounted through `createExpressRuntime(...)`.

Both require the `x-api-key: local-dev` guard, parse JSON bodies and serialize identical responses, so only the stack differs. Each container exposes the same workload to k6.

## Running

From the repository root:

`docker compose -f benchmarks/docker-compose.yml up --build --abort-on-container-exit`

k6 runs the script sequentially against both targets. Every fifth request is a `POST /users`; the rest are `GET /users`. After the run, `results/` contains the k6 end-of-test summaries (`express.summary.json`, `smite.summary.json`) with requests per second, latency statistics and the failure rate.

Render the comparison table with `node benchmarks/scripts/compare.mjs`.

## Knobs

The workload is configured through container environment variables, overridable on the compose command line:

- `VUS` - concurrent virtual users (default 50).
- `DURATION` - load duration per target (default 30s).

For example, `VUS=100 DURATION=1m docker compose -f benchmarks/docker-compose.yml up --build --abort-on-container-exit` runs 100 virtual users for a minute against each stack.

## Results

The numbers below are rendered from the k6 summaries in `benchmarks/results/` at documentation build time. They always come from a real load test rather than a fixed snapshot. Because route matching stays native to Express, the bridge only moves handler execution into the Smite pipeline and the two stacks are expected to be within noise of each other.

@benchmark
