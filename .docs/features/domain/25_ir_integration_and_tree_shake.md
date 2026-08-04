# 25. IR integration and tree-shaking (`domain.handler`, bundle proof)

## Goal

Wire `@smitejs/domain` usecases into the collect-mode IR graph so the CLI can
traverse `app → http.route → http.endpoint → domain.usecase`, *without* making
`@smitejs/domain` depend on `@smitejs/http` (preserving the one-way wall). Provide
`domain.handler(usecase, deps)` — an `HttpHandler` adapter the `@smitejs/http`
`handler()` builders can recognize and relate. Prove with a bundle test that the
production build drops every registry/IR reference yet the usecase runs.

## Context

`@smitejs/http` already stores endpoint handlers as `http.handler` nodes under
`route → endpoint → handler`. To make a usecase a real "operation", the user
writes `route.accept("POST", "/orders").handler(domain.handler(placeOrder, deps))`
and the IR should note that `http.handler` *implements* a `domain.usecase`. The
constraint: `@smitejs/domain` cannot import `@smitejs/http`. So `@smitejs/http` must
depend on a tiny surface from `@smitejs/domain` (metadata symbol), not vice-versa.

## Design

### A non-enumerable usecase marker (like `@smitejs/fp` extractors)

`usecase(...)` and `domain.handler(...)` carry a non-enumerable symbol that
`@smitejs/http` reads without importing logic:

```ts
export const domainHandlerSymbol: unique symbol = Symbol.for("@smitejs/domain/handler");
export type DomainHandler<T> = HttpHandler<T> & {
  readonly [domainHandlerSymbol]?: {
    usecaseNode: Descriptor<string, unknown>; // carried directly — no lookup import
    deps: Record<string, unknown>;
  };
};
```

`domain.handler(usecase, deps)` returns a function `(ctx) => TaskResult` marked
this way, and runs `usecase.with(deps)(ctx.body)` mapping `Result.ok → HttpResponse`
(200) and `Result.err → configurable error status/message).

### `@smitejs/http` recognizes it (not a hard dep)

In `endpoint.ts`, `handler(fn)` exposes a detection hook: if `fn` carries
`domainHandlerSymbol`, it relates `http.handler` → `domain.usecase` edges. The
implementation reads the metadata via `Symbol.for` with the same string — an
inline accessor in `endpoint.ts`, so `@smitejs/http` keeps **zero dependency** on
`@smitejs/domain`. The carried `usecaseNode` is used directly; no `lookup`/registry
import is added, so the production bundle tree-shakes exactly as before.

```ts
const DOMAIN_HANDLER = Symbol.for("@smitejs/domain/handler");
// in handler(fn): relate(handler, "domain.usecase", meta.usecaseNode) — guarded
```

Because this is collect-mode-only, the edge creation is guarded by the raw
`ALLOW_GLOBAL_REGISTRY` check and never ships.

### Bundle tree-shake proof

A `packages/domain/src/tree-shake.test.ts` (pattern-copy of
`packages/http/src/tree-shake.test.ts`):

1. esbuild-bundle a tiny domain app with `ALLOW_GLOBAL_REGISTRY: "false"`.
2. Assert the bundle contains no `globalRegistry` / `lookup` / `relationships`
   strings.
3. Execute the bundle and assert the usecase still runs (mitigates string-match
   fragility), including a failed specification returning its reason.

## Implementation steps

1. Add the non-enumerable `domainHandlerSymbol` + `domain.handler` adapter in
   `src/handler.ts`; `getDomainHandlerMetadata` accessor.
2. Gate the adapter's IR-ish registration behind the raw guard (the handler is
   `sideEffects: false` already).
3. Add a tiny optional detection to `packages/http/src/endpoint.ts` `handler`
   that, when the symbol is present, `relate`s the `http.handler` node to the
   `domain.usecase` node. Use a **weak optional linkage** (import a helper from
   `@smitejs/domain` only inside the guarded collect-mode branch — see DIP note).
4. `domain/tree-shake.test.ts` bundle test (production behavior + string proxy).
5. `docs/concepts/` note explaining the runtime/build split (collect mode).

## Edge cases & error handling

- **Not-a-usecase**: a normal function handler stays a plain `http.handler` —
  the symbol is absent, no relation.
- **Missing deps**: `domain.handler(uc, deps)` binds deps at creation; if `deps`
  lacks a port the usecase `run` returns `domain:deps` error at request time.
- **Error → HTTP**: `err` of `{tag, data}` maps to a default 422 (or a caller
  `{onError}` mapping); never a thrown exception escaping `router`.
- **Bundle**: the collect-mode `relate`/registry blob must vanish — verified by
  the bundle test; the runtime core (usecase pipeline) must not.

## Definition of done

- `domain.handler(usecase, deps)` is usable as an `@smitejs/http` handler and the
  http executor walks it; the relation `http.handler → domain.usecase` appears
  in collect mode.
- `packages/domain/src/tree-shake.test.ts` passes: no `globalRegistry`, usecase
  runs.
- `@smitejs/domain` still imports only `fp` + `core` (+ `zod`) — no new reverse
  edge.
- No new Biome violations; `docs.test.ts` green.

## Dependencies / prerequisites

- `domain/20`–`24`; `@smitejs/http/src/endpoint.ts` (read-only), `esbuild` in
  devDeps.

## Notes / open questions

- **Weak coupling**: `@smitejs/http` reaching into `@smitejs/domain` is the _only_
  crossing we allow (the framework's glue). If unacceptable, the alternative is
  a `registry`-hosted "handler → usecase" resolver the CLI inspects; document
  the chosen option. Prefer the symbol-marker — it keeps a
  `sideEffects: false`-safe, framework-agnostic boundary.
- Surface-name decision: `domain.handler(...)` vs `handler` re-export. Keep
  `domain.` namespacing to avoid clobbering `@smitejs/http`/`@smitejs/fp`'s
  `handler`.
- The metadata/relation mechanism mirrors `@smitejs/fp`'s `compositionMetadata`/
  `extractorMetadata` — DRY the symbol-identification pattern, not the data.