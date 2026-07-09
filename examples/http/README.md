# HTTP Example

Small example project that imports `@smite/core` and builds a simple HTTP controller.
The executable server uses `express` and `@smite/express`.

## What it shows

- `http.controller()`
- `http.route.get()` and `http.route.post()`
- `lifecycle.create().guards(...)`
- `express()`
- `createExpressRuntime(...)`

## Build

```sh
yarn workspace @smite/example-http build
```

## Run

```sh
yarn workspace @smite/example-http start
```

The server listens on `http://localhost:3000` by default.

## Endpoints

- `GET /users`
- `POST /users`

Example:

```sh
curl -H 'x-api-key: local-dev' http://localhost:3000/users
curl -X POST http://localhost:3000/users -H 'x-api-key: local-dev' -H 'content-type: application/json' -d '{"name":"Lin"}'
```
