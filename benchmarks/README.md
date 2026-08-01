# Benchmarks

Load-tests `@smite/example-http`'s two server variants with k6 running in Docker.
Measurement is delegated to k6 - this repository never times requests itself.

## Stacks

- `express` - plain Express app (`examples/http/src/express-app.ts`)
- `smite` - the same endpoints via `createExpressRuntime` (`examples/http/src/smite-app.ts`)

## How it works

`docker-compose.yml` builds a single image from the repository root, then runs it
as two server containers (`express`, `smite`), each on its own network alias. A
`k6` service runs the same mixed workload (every 5th request is a `POST /users`,
the rest are `GET /users`) against both, sequentially, and writes aggregated
summaries to `results/`:

- `express.summary.json` - k6 end-of-test summary for the express stack
- `smite.summary.json` - k6 end-of-test summary for the smite stack

The summaries are written by the script's `handleSummary` and contain requests
per second, latency statistics and the failure rate. To also capture the full
per-request data, add `--out json=/results/<name>.json` to the k6 command.

## Run

```sh
docker compose -f benchmarks/docker-compose.yml up --build --abort-on-container-exit
```

After it finishes, render the comparison table:

```sh
node benchmarks/scripts/compare.mjs
```

## Knobs

Override the workload through compose environment variables:

```sh
VUS=100 DURATION=1m docker compose -f benchmarks/docker-compose.yml up --build --abort-on-container-exit
```

- `VUS` - concurrent virtual users (default `50`)
- `DURATION` - load duration per target (default `30s`)
