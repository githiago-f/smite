# 24. Usecase and CQRS (`usecase`, `command`, `query`)

## Goal

Ship the usecase builder — the heart of `@smite/domain`. A usecase is a named,
pure pipeline that returns `TaskResult<Output, E>`, receives its dependencies
(ports) via injection, validates input with zod, and records a `domain.usecase`
IR node. `command` and `query` are thin aliases that set the CQRS kind. Usescases
are run by wiring them into an executor (http, in `25`), not directly.

## Context

Slices `21`–`23` give value objects, entities, specs and ports. A usecase is the
"operation" the user asked about: the single unit of behavior that the
application exposes (a command mutates, a query reads). It must be pure (unit
-testable without real I/O), must not throw (returns `Result`/`TaskResult`), and
must depend only on ports (DIP). KISS: a usecase is one function plus metadata —
no framework around it.

## Design

### `usecase({ name, kind?, input?, deps?, handle })`

```ts
const placeOrder = usecase({
  name: "PlaceOrder",
  kind: "command",
  input: z.object({ userId: z.string().uuid(), sku: z.string(), qty: z.number().int().positive() }),
  deps: ["orders", "products"],
  handle: ({ orders, products }, cmd) =>
    TaskResult.from(async () => {
      const product = (await products.findById(cmd.sku)).recover(() => null);
      if (!product) return Result.err("product:not-found", { sku: cmd.sku });
      const order = Order.create({ id: await uid(), ...cmd });
      await orders.save(order);
      return Result.ok(order);
    }),
});
```

- `input` is an optional zod schema; when present the runner validates the input
  first and returns `err("domain:invalid-input", issues)` (never throws).
- `handle(deps, input)` is the pure core: returns `MaybePromise<Result<Output,
  E>>`. Everything async flows through `TaskResult.from`/`flow`.
- The factory returns a `Usecase<Deps, Input, Output, E>` object with:

  ```ts
  type Usecase = {
    readonly name: string;
    readonly kind: "command" | "query";
    run(input, deps): TaskResult<Output, E>;   // full injection
    with(deps): (input) => TaskResult<Output, E>; // partial application
    id(): string;                               // composite key, for IR + wrapping
  };
  ```

- `command(...)` / `query(...)` — `usecase({ ... , kind })` shorthands so intent
  (mutate vs read) is explicit in the caller's name.

### CQRS split

KISS says the *execution model* is the same for both — no separate kernel, no
duplication. `command`/`query` differ only by the `kind` flag recorded in the
IR. The type system does not enforce read-onlyness, but the `kind` guides
tooling and future OpenAPI generation.

### IR registration

- `domain.usecase` node: `{ name, kind, inputSchema, deps }`, guarded by the
  raw inline `ALLOW_GLOBAL_REGISTRY` check. Folded out of production bundles.
- `deps` is stored as the port-name list so the CLI can trace the dependency
  graph.

### File layout

- `src/usecase.ts` — `usecase`, the `Usecase` type, `with`/`run` plumbing.
- `src/cqrs.ts` — `command`/`query` aliases.
- Re-exported from `src/index.ts`.

## Implementation steps

1. `usecase.ts`: build the `Usecase` object; `run(input, deps)` validates
   `input` (if schema) then runs `handle` via `TaskResult.from`. `with(deps)`
   returns a partial-applied `run` bound to those deps.
2. IR `domain.usecase` (shared guard, `21`).
3. `cqrs.ts`: `command`/`query` set `kind`.
4. Tests:
   - sync and async usecases;
   - validation failure returns `err`, not throw;
   - `.with(deps)` returns a bound runner and single-run `run(input, deps)`;
   - `.run` returns `TaskResult` (isOk/isErr) and does not throw on port failure.
5. `#Section` snippets (sync, async, validation) + `docs.test.ts`.
6. `docs/concepts/usecases.md` concept doc.

## Edge cases & error handling

- **Missing `deps` on `run`** → `err("domain:deps", { missing })` rather than
  throwing.
- **Input schema null**: `input` omitted → skip validation; caller owns typing.
- **Parallel deps**: `.with(...)` binds all deps; the runner resolves before and
  after each `handle` to keep deps flow to fixed by-bound injection.
- **`kind` default**: `"command"` if unset (name suggests the command
  shouldn't confuse reads).
- **Composite-key collision**: two usecases with the same `name` in one
  registry → registrar error (consistent with `21`).

## Definition of done

- `usecase`/`command`/`query` shipped; validation-failure→`err`;
  `run`/`with`; CQRS `kind`; IR node guarded.
- Sync + async + error tests pass; no `globalRegistry` at runtime (verified by
  a follow-through `tree-shake` in `25`).
- `docs.test.ts` green; concept doc renders; no new Biome violations.

## Dependencies / prerequisites

- `domain/20`–`23` (skeleton, VOs, ports, specs), `@smite/fp` `Result`/
  `Task`/`TaskResult`/`flow`.

## Notes / open questions

- **Validation error shape**: `err("domain:validation", issues)` where `issues`
  are zod `z.parse` issues → a stable `{ tag, data }`.
- **Read-only `query`**: decided not to invent an enforcer; `kind` is a
  soft contract the CLI/OpenAPI generation can later read. The real guard lives
  in tests/docs, matching the framework's "tests documentation" ethos.