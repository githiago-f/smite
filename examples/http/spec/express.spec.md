# Express Specification

Source: `@smite/spec` — deterministic Express wiring for Smite HTTP descriptors.
Generated from 1 controller.

## Mounting

Each controller becomes a native Express router mounted at its controller path.

- app.use("/users", usersRouter)

## usersRouter — /users

| Method | Path | Handler |
|--------|------|---------|
| GET | / | listUsers |
| POST | / | createUser |

### GET / — merged lifecycle

1. guard: api-key
2. pipe: parse-user-body
3. filter: json-errors — runs only on error

### POST / — merged lifecycle

1. guard: api-key
2. pipe: parse-user-body
3. filter: json-errors — runs only on error
