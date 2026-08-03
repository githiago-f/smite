---
title: Entities
summary: Frozen values with a stable identity, compared by id, not by fields.
order: 20
---

An entity is a value that keeps a stable identity across changes. Two entities
are the *same* when their `id` matches, even if every other field differs — that
is what distinguishes an entity from a value object.

`domain.entity({ name, id, schema })` declares the identity key and the shape.
`create(input)` validates and returns a frozen entity (or a `domain.validation`
failure), and `equals(other)` compares by identity. Entities are the natural
carrier for the things you persist and reference: orders, customers, accounts.

Keep the `id` in the schema and point `id` at it. Everything else — note, status,
quantity — can change, but the identity is fixed for the lifetime of the entity.

@example Entity identity