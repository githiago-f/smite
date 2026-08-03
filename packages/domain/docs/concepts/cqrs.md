---
title: Commands and queries (CQRS)
summary: Separate operations that change state from operations that read it.
order: 60
---

CQRS is the discipline of splitting every operation into a *command* (something
that mutates state) or a *query* (something that only reads). `domain.command`
and `domain.query` are the `kind` shortcuts on `domain.usecase` that make the
distinction explicit in the name, the IR, and the docs.

- **Commands** take an intent (`place an order`) and return a confirmation or a
  failure. They write through write-ports and are the only place state changes.
- **Queries** take a lookup (`give me order 42`) and return a read model. They
  go through read-ports and must not mutate anything.

Two practical payoffs fall out of the split:

- The read model can differ from the stored entity — a query may return a
  projection shaped for the screen, not the raw aggregate.
- Rules on *writing* (specifications, ownership, limits) never collide with the
  freedom of *reading*.

Wire commands and queries to the transport the same way — a command like
`POST /orders`, a query like `GET /orders/:id` — each with its own handler, its
own port requirements, and its own `Result`.

@example Define a usecase