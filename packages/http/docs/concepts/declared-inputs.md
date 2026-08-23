---
title: Declared inputs
summary: Declaring and validating route inputs with zod.
order: 20
---

Handlers should receive values they can trust. `http.router().input(config)`
declares schemas for each input bucket — `query`, `params`, `headers`, `body` —
and those schemas flow into two places at once: runtime validation and the
handler's TypeScript types.

## Declaring schemas

Pass zod schemas in the `input` call. Any bucket you omit is treated as an
unvalidated, loosely-typed bucket.

@example Declare validated inputs

## Types follow the schemas

`HttpHandlerContext<Config>` infers each bucket from its schema. Declare
`params: z.object({ slug: z.string() })` and `ctx.params.slug` is typed as
`string` with no extra annotation. Undeclared buckets degrade to sensible
loose types (`params` to a string map, `query` to `unknown` values, ...).

## Validation happens at serve time

When a request arrives, `serve` parses the matched buckets with the schemas. A
failed parse becomes a `400` with the zod issues as the body; a successful
parse produces the typed context the handler receives. This is where zod-only
validation lives — Smite does not invent a second validation system.