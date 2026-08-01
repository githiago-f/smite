# HTTP Example

Compares a plain Express server with the same server built on Smite. Both expose
identical endpoints so the two stacks can be benchmarked side by side.

## What it shows

- `http.controller()`
- `http.route.get()` and `http.route.post()`
- `lifecycle.create().guards(...)`
- `createExpressRuntime(...)` mounting Smite controllers on Express
- The equivalent plain-Express implementation

The two servers ship as executable entry points. Load-testing them lives in the
`benchmarks/` directory (k6 + Docker), not here.

## Endpoints

Both servers expose:

- `GET /users` - guarded list
- `POST /users` - guarded create that echoes the parsed body

Requests must send `x-api-key: local-dev`.

```sh
curl -H 'x-api-key: local-dev' http://localhost:3000/users
curl -X POST http://localhost:3000/users -H 'x-api-key: local-dev' -H 'content-type: application/json' -d '{"name":"Lin"}'
```

## Build

```sh
yarn workspace @smite/example-http build
```

## Run

Smite + Express (default port `3000`):

```sh
yarn workspace @smite/example-http start
```

Plain Express:

```sh
yarn workspace @smite/example-http start:express
```

## Benchmark

See `benchmarks/README.md` for the k6 + Docker load-test setup.
