# @smitejs/domain

A functional DDD toolkit for Smite applications. It gives you the building
blocks to model a domain as immutable values and named operations, without
enforcing a framework or a container.

## CLI workflow

Install it with `npm install @smitejs/domain @smitejs/http zod` and use
`npx smite dev` to run an HTTP app whose handlers delegate to domain usecases.
For the complete in-memory orders example, run `yarn workspace
@smitejs/example-domains-orders start` and call it with `curl`.

## When to reach for it

Reach for `@smitejs/domain` as soon as a route starts to smuggle business logic
into an HTTP handler. It draws a clean line between the **what** (your rules,
values, and operations) and the **how** (transport, storage, plumbing).

## What's inside

- **Value objects** — frozen, structurally-equal values.
- **Entities** — frozen values compared by identity.
- **Specifications** — named rules that fail with a reason.
- **Ports** — explicit I/O boundaries for a functional core.
- **Usecases** — commands and queries that own the rules.
- **CQRS** — a deliberate command / read split.

Every operation returns a `Result`, so failures are data you can branch on, not
exceptions that unwind the stack.

## Getting started

`examples/domains-orders` proves the whole path end-to-end: `http.app` routes →
`domain.handler` → usecases → specifications → ports → an in-memory repository.
Run it with:

```sh
yarn workspace @smitejs/example-domains-orders start
```

then `POST /orders` (place an order) and `GET /orders/:id` (read one back).

## Concepts

- Value objects — entities — specifications — ports and the functional core —
  usecases — commands and queries.

## Architecture

`@smitejs/domain` sits on `@smitejs/fp` (for `Result`/`TaskResult` composition) and
`@smitejs/core` (for collect-mode registration), and depends on nothing else. In
collect mode each builder registers a `domain.*` node; at runtime the executors
walk the IR without touching the registry.
