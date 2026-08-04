# 21. Value objects and entities (`valueObject`, `entity`)

## Goal

Ship the value-object and entity factories: immutable, zod-validated domain
values with structural equality (`valueObject`) and identity equality
(`entity`). Each factory registers a `domain.*` IR node so the collect-mode
CLI can enumerate the domain vocabulary; each unit composes only
`@smitejs/fp` + `@smitejs/core` + `zod`.

## Context

Value objects and entities are the atoms of a domain model. KISS says: a value
object is a **frozen record** validated once at construction and compared by
value; an entity is a value object that adds a stable `id` compared by identity.
There is no hidden state machine, no proxy, no serialization magic — the
factories are thin, and DRY means `entity` reuses the `valueObject` kernel
rather than duplicating it.

## Design

### `valueObject({ name, schema })`

Returns a `ValueObjectFactory<Shape>`:

```ts
const Money = valueObject({
  name: "Money",
  schema: z.object({ amount: z.number().nonnegative(), currency: z.string() }),
});

// Create: validates once, freezes, returns Result (never throws)
const m1 = Money.create({ amount: 10, currency: "EUR" });
// => Result.ok<MoneyVO, ValidationError>

// Structural equality (frozen snapshot compare, not reference compare)
m1.equals(Money.create({ amount: 10, currency: "EUR" })); // true
Money.create({ amount: 5, currency: "EUR" }).equals(m1);  // false
```

- `create(input): Result<ValueObject<Shape>, E>` — zod parse → `Result.ok` /
  `Result.err`; on success deep-freezes the snapshot (mirrors
  `@smitejs/core` freeze discipline) so the value is immutable.
- `parse(input): ValueObject<Shape>` — convenience that throws on invalid input
  (documented escape hatch for trusted inputs).
- `equals(other): boolean` — structural compare on the frozen snapshot.
- `hash(): string` — stable canonical string (JSON of the frozen snapshot,
  keys sorted) for Set/Map identity and future persistence.

### `entity({ name, schema, id })`

Reuses the value-object kernel and adds identity:

```ts
const User = entity({
  name: "User",
  id: z.string().uuid(),
  schema: z.object({ name: z.string(), email: z.email() }),
});

const u1 = User.create({ id: "…", name: "A", email: "a@x.io" });
const u2 = User.create({ id: "…", name: "A", email: "a@x.io" });
u1.equals(u2); // true — same id

User.create({ id: "other", name: "A", email: "a@x.io" }).equals(u1); // false
```

- `create` returns `Result<Entity<Shape>, E>`; `id` is part of the shape and is
  validated by its own zod schema (the `id` key is removed from the body schema
  internally — DRY over composition).
- `equals` compares **by `id` only** (identity, per DDD) — two entities with the
  same id are the same entity regardless of field drift.
- `hash()` returns the id.
- `entity` is implemented as `valueObject` + an id extractor + overridden
  `equals`/`hash` — one kernel, two policies.

### IR registration (both factories)

- `defineDescriptor("domain.valueObject", name, { name, schema })` where
  `schema` is stored as the zod instance (build-time only; the registry folds
  out in production).
- `defineDescriptor("domain.entity", name, { name, idKey, schema })`.
- Guards reference the raw `ALLOW_GLOBAL_REGISTRY` identifier inline. The
  registry walkers in `@smitejs/client`/CLI can later enumerate these nodes; at
  runtime the factory is a plain immutable-value helper.

### File layout

- `src/value-object.ts` — `valueObject` kernel + `ValueObjectFactory`/`ValueObject`
  types.
- `src/entity.ts` — `entity` (imports the kernel).
- `src/index.ts` re-exports both.

## Implementation steps

1. `value-object.ts`: `valueObject({ name, schema })` → factory with
   `create`/`parse`/`equals`/`hash`; frozen snapshot; `Result`-returning
   `create` (map zod issues to `Result.err`).
2. IR node `domain.valueObject` with the raw-identifier guard (add the helper
   once — a local `registerDomainDescriptor` mirroring `@smitejs/core`'s usage
   stays DRY across `21`–`24`).
3. `entity.ts`: reuse the kernel; id schema + identity `equals`/`hash`.
4. `index.ts` barrel; `docs.test.ts` sections for two `@example` titles
   (value objects, entities) with matching `#section` snippets in the test
   files.
5. Tests: structural vs identity equality, immutability (freeze), invalid
   input → `Result.err`, id-validated entity.
6. `docs/concepts/value-objects.md` concept doc (frontmatter
   `order`/`title`/`summary`).

## Edge cases & error handling

- **Invalid input**: `create` returns `err`; `parse` throws only when the caller
  explicitly opts in.
- **NaN / extra keys**: zod strips unknown keys by default and rejects `NaN`
  per schema — document that `schema` is the single source of truth.
- **Freeze depth**: deep-freeze the snapshot so nested arrays/objects cannot be
  mutated; `equals` compares snapshots (already-frozen) by value.
- **Nested value objects**: `schema` may reference another `valueObject`'s
  schema; `hash`/`equals` remain structural.
- **Duplicate names** across factories → composite-key collision error from the
  registrar (message names the duplicate).
- **Production bundle**: no registry reference survives (`define` folded);
  `create`/`equals`/`hash` work standalone.

## Definition of done

- `valueObject`/`entity` produce frozen, validated values; equality and hash
  follow the two policies (value vs id).
- IR nodes `domain.valueObject`/`domain.entity` visible in collect mode with
  raw-identifier guards; no `globalRegistry` reference at runtime.
- `docs.test.ts` green; concept doc renders in `yarn docs:build`.
- No new Biome violations.

## Dependencies / prerequisites

- `domain/20` (package skeleton).
- `@smitejs/fp` `Result`, `@smitejs/core` descriptor/guard, `zod`.

## Notes / open questions

- Should `equals` compare zod *parsed* snapshots or the raw input? — Parsed
  snapshot (normalized by the schema). Edge: two inputs that parse to the same
  normalized value are equal.
- `hash` stability across versions: keep it derived from the snapshot only;
  persistence-friendly serialization is a follow-up.