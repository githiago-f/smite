# 26. `@smite/domain` example app and docs

## Goal

Close `@smite/domain` with a runnable example workspace and its concept docs:
`examples/domain-orders` demonstrates the full "operation" end-to-end
(`http.app` routes → `domain.handler` → usecases → specifications → ports →
in-memory repository), runnable with one `yarn workspace` command. Docs:
`packages/domain/docs/index.md` + `docs/concepts/*.md`, with test-backed
`@example` `#section` snippets enforced by `docs.test.ts` and rendered by
`yarn docs:build`.

## Context

Slices `20`–`25` implemented the toolkit. This slice proves it composes into the
existing compiler path (collect-mode IR + runtime executor) exactly the way the
roadmap intended, and documents the units as workflow concepts (over the
framework's Internals convention in `meta/19`). The example is a small
order-management API that reads like product intent.

## Design

### Example app: `examples/domains-orders` (`@smite/example-domains-orders`)

A single `.mjs` (`src/server.mjs` + `src/app.mjs` to mirror
`examples/http-rest-server`), importing `@smite/http`, `@smite/domain`,
`@smite/fp` and `zod`:

- **Domain**: `OrderId` (value object), `Order` (entity), `PlaceOrder` (command),
  `OrderStatus` specification, `ActiveCustomer` spec.
- **Ports**: `OrderRepository` (write), `OrderReadModel` (read) — in-memory Maps.
- **Usecases**: `PlaceOrder` (command) and `GetOrder` (query).
- **Routes**: `POST /orders` → `domain.handler(placeOrder, deps)`; `GET /orders/:id`
  → `domain.handler(getOrder, deps)`.
- `app.serve()` drives a real `node:http` server; same bootstrap/pattern as the
  existing `examples/http-rest-server`.
- Runnable: `yarn workspace @smite/example-domains-orders start` (and the server
  prints the `curl` lines like the sibling example).

The loop proves: route → `domain.handler` → usecase → port (in-memory) → value
object/entity/spec — a complete "domain operation" wired through the framework.

### Docs

- `packages/domain/docs/index.md` — landing (what the toolkit is, when to reach
  for it, link to `26` example).
- `docs/concepts/{value-objects,entities,specifications,ports-and-functional-core,usecases,cqrs}.md`
  — workflow concepts (frontmatter `order`/`title`/`summary`; inline `@example`).
  Any IR/registry detail lives under `docs/concepts/internals/` per `meta/19`.
- Each public API in `src/**/*.ts` carries `@group`/`@intent`/`@example <Title>`
  JSDoc resolving to a tested `#section` snippet (asserted by `docs.test.ts`
  from `20`).

## Implementation steps

1. `examples/domains-orders/package.json` (`@smite/example-domains-orders`,
   `private`, deps `@smite/http`, `@smite/domain`, `@smite/fp`, `zod`; `start`
   script) + `.mjs` sources.
2. Write `src/domain.mjs` (VOs, entity, spec, port) and `src/app.mjs` (usecases +
   routes) and `src/server.mjs` (bootstrap). Biome-clean (`examples` are linted).
3. Prove runnable: `yarn build` then `yarn workspace
   @smite/example-domains-orders start` and `curl` two routes.
4. Write the concept docs + `docs/index.md`; align `order` frontmatter + its
   inline `@example`.
5. Add `#snippet` + `docs.test.ts` sections for every `@example` (driven by
   `20` harness). `yarn docs:build` renders the concepts + reference.

## Edge cases & error handling

- **Example must import built dist** (not src) — it depends on `dist` from
  `yarn build`; the `start` script assumes built packages (same as the existing
  examples).
- **`.mjs` linting**: keep the example Biome-clean (2-space indent, no unused);
  the monorepo `biome check .` scope includes `examples/**`.
- **Concept vs Internals**: framework-internal pieces (IR, symbols, collect
  mode) belong under `concepts/internals/`; the five workflows are user-facing.
- **Docs/test drift**: every `@example` must resolve to a `#section`; `docs.test.ts`
  fails CI on a missing/renamed snippet.

## Definition of done

- Example server runs `POST /orders` and `GET /orders/:id`, exercising the whole
  path with real requests returning shaped `HttpResponse`.
- `yarn test`, `yarn build`, `yarn format`, `yarn biome check .` all green
  (domain suite included); `yarn docs:build` renders domain concepts + the
  reference.
- Concepts are workflow-first (no IR/walker vocabulary in the user-facing docs).

## Dependencies / prerequisites

- `domain/20`–`25` (all implemented); `@smite/http` `serve` (from http/11).

## Notes / open questions

- **Example naming**: `domains-orders` (matched to `fp-utils`/`typed-client`
  plural scheme). Confirmed prefix `@smite/example-domains-orders`.
- **Event/aggregate**: remains the deliberately deferred follow-up (aggregate).
  The example's command uses a simple save, not an event log.
- Thin state model keeps the example short and KISS; persistence port is ready
  to swap for a real one.