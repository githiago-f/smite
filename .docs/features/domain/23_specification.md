# 23. Specifications (`specification`, `mergeSpecifications`)

## Goal

Ship the specification builder: a composable, named business rule that returns a
typed `Result<boolean, Reason>` instead of a bare boolean, so a failed rule
carries *why*. Provide open/closed combinators (`and`, `or`, `not`) and
`mergeSpecifications` for cross-rule composition, plus a `domain.specification`
IR node.

## Context

A predicate (`(t) => boolean`) loses the failure reason. In a domain you want:
"this user can place an order — *or* rejection reason X". `@smite/fp` already
has boolean predicate combinators (`and`, `or`, `not`). DRY means we reuse them;
we only lift the boolean result into a `Result` with an optional `Reason`.

## Design

### `specification({ name, predicate })`

```ts
const ActiveAccount = specification({
  name: "ActiveAccount",
  predicate: (u: User) => u.status === "ACTIVE" ? ok(true) : err("account:inactive", { id: u.id }),
});
```

Returns a `Specification<T>`:

```ts
type Specification<T> = {
  readonly name: string;
  isSatisfiedBy(input: T): Result<boolean, Reason>;
  and(...others: readonly Specification<T>[]): Specification<T>;
  or(...others: readonly Specification<T>[]): Specification<T>;
  not(): Specification<T>;
};
```

- `isSatisfiedBy` forwards fp's `Result.ok(true)` / `Result.err(tag, data)` for
  the reason — zod-typed `Reason = { tag, data? }` expressed via fp's
  `err(tag, data)` two-arg form.
- `and` short-circuits at the first failure and returns that reason (no wasted
  evaluations); `or` returns the first success.
- `not` inverts `ok(true)` ↔ `err(…)`, feeding a negation reason.
- `mergeSpecifications(...specs)` = `specs[0].and(...rest)`: an entry point for
  combining a checklist of rules.

### IR registration

`domain.specification` node: `{ name, operators }` where `operators` records the
combinators applied so the collect-mode CLI can visualize rule graphs. Raw
inline `ALLOW_GLOBAL_REGISTRY` guard; folded out of production.

### File layout

- `src/specification.ts` — builder + combinators + `mergeSpecifications`.
- Re-exported from `src/index.ts`.

## Implementation steps

1. `specification.ts`: implement `isSatisfiedBy` on top of the fp `Predicate`
   combinators; thread the `Reason` through `and`/`or`/`not`.
2. IR node `domain.specification` (shared guard helper).
3. Builder `.and()`/`.or()`/`.not()` return new composed objects — never mutate
   the original (open/closed).
4. Tests:
   - single rule passes / fails with reason;
   - `and` short-circuits and returns the first reason;
   - `or` short-circuits at the first pass;
   - `not` inverts;
   - composability is non-mutating.
5. `@example` `#section` snippet + `docs.test.ts` section.
6. `docs/concepts/specifications.md` concept doc.

## Edge cases & error handling

- **Zero-spec calls**: `mergeSpecifications()` with no specs → `ok(true)`; `and`
  with no others returns `true`; `or` with no others returns `false` (matches
  fp's `every`/`some` over an empty list).
- **Reasons with data**: `err(tag, data)` two-arg form is threaded unchanged; the
  first-in-selected-order reason wins — document the non-`and` semantics (first
  failure), not last.
- **Predicates vs specs**: fp `Predicate<T>` (`(t)=>boolean`) converts via a
  `predicate` adapter; `specification` itself is the domain-facing form.

## Definition of done

- `specification` + combinators + `mergeSpecifications` shipped; reason-fitted
  `Result`; non-mutating composition.
- IR node registered in collect mode; production bundle drops it.
- `docs.test.ts` green; no new Biome violations.

## Dependencies / prerequisites

- `domain/20` (skeleton), `domain/21` (value objects/entities as the `T` input),
  `@smite/fp` `and`/`or`/`not`/`Result`.

## Notes / open questions

- **Specs vs usecase guards**: a spec predicate is pure over its input. Rules
  that must read state (DB lookups, permissions) belong inside the usecase
  pipeline (`24`) where ports are available, then checked through a spec for
  naming and reuse.
- **Async rules**: keep `specification` synchronous; async rule evaluation is a
  usecase concern composed with `TaskResult` in `24`.