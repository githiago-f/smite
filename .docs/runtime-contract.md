# Runtime Contract

This document defines two contracts that every feature must satisfy and the
quality bar every deliverable must clear. It assumes `architecture.md` and
`extensibility.md` have been read.

Write once.

Run anywhere.

Functional, type-safe and performant.

The two contracts answer the questions this goal leaves open: *what* may be
written once, and *how* it must run.

---

# Portability Contract — Write Once, Run Anywhere

Application code describes intent. It never describes a platform.

The Semantic Graph is the single source of truth. Every output target is a
compile-time projection of that graph, never an ad-hoc reading of application
source.

## Rules

- Application code and the core express semantics only: controllers, routes,
  lifecycle, messaging consumers and scheduled jobs. Platform types appear only
  inside their own adapter or emitter.
- Every target is a compile-time projection of the Semantic Graph. Adding a
  target must not modify application code or the kernel.
- One target = one extension = one responsibility. An Express emitter, an
  OpenAPI projection and a PlantUML projection are three extensions, not one.
- A projection that needs information the graph lacks is a signal to add a
  builder (intent) or to enrich the graph during compilation — never to inspect
  source files at generation time.
- Projections are deterministic: identical graphs produce identical artifacts.

## Projection taxonomy

Three kinds of output share the same pipeline — Semantic Graph, intermediate
model, artifact — and differ only in what they produce:

| Kind | Produces | Examples |
|------|----------|----------|
| Runtime emitter | Executable platform-native source | Express, Fastify, Hono |
| Documentation projection | Non-executable renderings | Swagger/OpenAPI, PlantUML, markdown |
| Infrastructure emitter | Deployment manifests | CloudFormation, Terraform |

The canonical demonstration targets are **Express** (runtime emitter) and
**PlantUML** (documentation projection). Every new projection must follow the
same shape as these two.

---

# Bare-Metal Contract — Run Close to the Metal

Generated runtime must be indistinguishable in structure from hand-written
platform code for the same feature set, and within measurable distance of it in
performance.

## Rules

- Generated output is structurally equivalent to hand-written platform code:
  real routes, real plugins, no interpreter loop, no reflection, no per-request
  dispatch indirection.
- Zero-runtime-cost: a feature that only describes intent must compile away
  entirely. If it survives to runtime it must earn its per-request cost.
- The bar is benchmark-gated. Generated applications must stay within measurable
  distance of a hand-written twin, measured with the `benchmarks/` k6 harness.
  Record deltas; do not guess.
- A hand-written runtime abstraction is a smell that signals a missing emitter.
  If the behavior can be emitted as source, emit it.
- Runtime adapters translate platform I/O into the core execution context and
  result shape only. They never reimplement lifecycle ordering or routing.

---

# Reconciliation

Write-once decides **what** runs.

Bare-metal decides **how** it runs.

They conflict only when a runtime abstraction is written by hand instead of
generated. Before introducing runtime cost, triage:

> Would a hand-written app on this same platform pay this cost at runtime?

- **Yes** — the feature must be compiled away or be zero-cost in the core.
- **No** — the feature belongs in an opt-in extension the application loads.

---

# Type-Safe Without Runtime Cost

Types are a compile-time guarantee and must stay that way. Type-level work must
never become runtime validation, reflection or discovery. The type system
enforces intent; the generated runtime executes only what cannot be eliminated.

---

# Mandatory Quality Bar — Not Negotiable

Every public capability, in every package and every extension, requires all
three. These are not negotiable:

1. **At least one example.** A runnable example exists in `examples/` (or a
   tested snippet) demonstrating the capability end to end.
2. **Full docs on usage.** The capability is documented in its package
   `docs/concepts/` with working `@example` references that resolve to tested
   snippets, so the docs build fails when the example and the documentation
   drift.
3. **Tests.** The capability is covered by automated tests in the same package,
   validating behavior through the public API.

A capability that cannot be demonstrated by an example, documented, and tested
is not complete. Land it only when all three exist.

The `docs:build` pipeline enforces the linkage: `@example` references in JSDoc
and concept docs must resolve to tested `#section` snippets or the build fails.
Use the canonical Express and PlantUML targets as the reference for what
"complete" means.
