# 22. Ports and repositories (`port`, `Repository`)

## Goal

Ship the port layer that makes usecases Clean and SOLID by dependent inversion:
`port(...)` defines a narrow contract (with a `domain.port` IR node) and
`Repository` / `ReadPort` / `WritePort` give the standard repo shapes. A usecase
depends on the port; any implementation plugs in at `.with()`.

## Context

The most common SOL violation in a naive framework is a usecase calling a
concrete store (`db.users.findByEmail`) directly. The fix is a **port**: an
interface the application defines and the infrastructure implements. KISS says
a port is *just an interface* plus an IR registration — there is no dynamic
proxy, no service locator, no IoC container. DI = passing the implementation as
a function argument.

## Design

### `port({ name, methods })`

Registers a `domain.port` descriptor and returns the dependency surface for
tooling:

```ts
const accountPort = port({
  name: "AccountRepository",
  methods: ["findById", "save"],
});
```

The **contract itself is a plain TypeScript type** in the usecase — this keeps
KISS. The runtime call to `port(...)` only matters in collect mode, where it
records the port so the CLI can graph which ports each usecase depends on. At
runtime the call is a harmless registration that folds out of the bundle.

### Repository shapes (type-level, structural — DIP + ISP)

```ts
export type Repository<Value, Id> = {
  findById(id: Id): PromiseLike<Result<Value | null, unknown>>;
  save(value: Value): PromiseLike<Result<void, unknown>>;
};

export type ReadPort<Value, Id> = Pick<Repository<Value, Id>, "findById">;
export type WritePort<Value, Id> = Pick<Repository<Value, Id>, "save">;
```

- **Narrow ports** satisfy the ISP/LSP split: a read-only consumer depends on
  `ReadPort`, a writer on `WritePort`. Any object with those members satisfies
  the contract — swap an in-memory map for Postgres with zero usecase changes
  (the **L** substitution test).
- Usecases declare `deps: { accounts: ReadPort<User, string> }`; the caller
  passes any matching object. Nothing inside `@smitejs/domain` performs I/O.

### IR registration

`domain.port` node carrying `{ name, methods }`, guarded by the raw inline
`typeof ALLOW_GLOBAL_REGISTRY === "boolean" && ALLOW_GLOBAL_REGISTRY` check
(shared helper introduced in `21`). Dropped from production bundles.

### File layout

- `src/port.ts` — `port`, `Repository` / `ReadPort` / `WritePort`, and the
  `domain.port` registrar wrapper.
- Re-exported from `src/index.ts`.

## Implementation steps

1. `port.ts`: `port({ name, methods })` (IR-only registration) + the three type
   aliases.
2. `domain.port` node via the shared raw-identifier guard helper.
3. Tests:
   - **L**: a usecase written against `ReadPort` runs against an in-memory map
     repo and a hand-rolled fake, with identical behavior and no reference to a
     concrete class.
   - **ISP**: `ReadPort` is satisfied by any object exposing `findById`; a
     consumer typed `WritePort` cannot compile against `findById`.
4. `@example` `#section` snippets + `docs.test.ts` sections.
5. `docs/concepts/ports-and-functional-core.md` concept doc.

## Edge cases & error handling

- **Missing method on the injected impl**: `.with(deps)` checks the required
  method keys against the port's `methods` list and returns an `err` naming the
  missing method. Collect-mode only; the runtime `.with` fast-paths to a shape
  check that stays tree-shakeable.
- **Async vs sync**: repo bodies may return `PromiseLike<Result>`; `@smitejs/fp`
  `TaskResult.from` normalizes them. Sync functions coerce via `Task.of`.
- **No reflection**: the contract is type-level and structural; `port` never
  synthesizes interfaces at runtime — document that introspection of method
  signatures is out of scope.

## Definition of done

- `port`, `Repository`, `ReadPort`, `WritePort` in the barrel; the **L** and
  **ISP** substitution tests pass.
- `domain.port` IR node registered in collect mode; no `globalRegistry`
  reference at runtime.
- Concept doc + `docs.test.ts` green; no new Biome violations.

## Dependencies / prerequisites

- `domain/20` (skeleton), `domain/21` (value objects/entities as the `Value`
  shapes), `@smitejs/core`, `@smitejs/fp`, `zod`.

## Notes / open questions

- **Repository persistence schemas** (SQL/event tables) are deliberately out of
  scope: storage lives behind the port and is injected. A future slice could add
  a `repository` adapter that maps a zod table schema to a standard
  implementation.
- The `26` example uses an in-memory map for the command's `WritePort` and a
  read model for the query's `ReadPort` — both plain objects satisfying these
  types.