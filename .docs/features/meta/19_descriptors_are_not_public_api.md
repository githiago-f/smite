# 19. Descriptors are not public API: move IR docs under an "Internals" group

## Goal

Reframe the docs taxonomy so the framework's own internals — the descriptor IR
(nodes, edges, the global registry, the app junction, the immutability
lifecycle) — are not presented as user-facing "workflow" concepts. Move them
out of each package's primary Concepts list and into a dedicated **Internals**
sub-menu, and rewrite the workflow-facing docs to lead with usage, not with how
the machinery is built.

Scope: **docs taxonomy only.** Do NOT change the `@smitejs/core` public barrel
(`defineDescriptor`, `Descriptor`, `relate`, … remain exported). "Descriptors
are not public API" here means the IR is not part of the user-facing workflow
story; `@smitejs/core` stays a normal package with a normal reference page.

## Context

The docs site (`scripts/build-docs.mjs`) rendered every concept doc as a flat
"Concepts" item in the sidebar and package overview, and the landing page
promoted internal machinery ("graph of descriptors", "global registry",
"ALLOW_GLOBAL_REGISTRY") as headline features. `@smitejs/core`'s concepts describe
the internal representation later transports (http/client/env), tooling, and
the future compiler build on. Presenting these as first-class workflow concepts
leaked implementation detail into the user journey.

## Design

### 1. Folder convention: `docs/concepts/internals/`

Concept docs under `packages/*/docs/concepts/internals/*.md` (any depth) are
classified as **internals**; everything else under `concepts/` is a **workflow**
concept. The builder derives `category` from the file's path relative to the
concept dir (`path.relative(...).startsWith("internals")`). `collectFiles`
already recurses, so no new scan code.

Moved into `packages/core/docs/concepts/internals/`:
- `descriptor-nodes.md`
- `edges.md`
- `registry.md`
- `junction.md`
- `immutability.md`

`@smitejs/core` therefore ships zero workflow concepts; its whole slate renders
under Internals, which reads correctly as "the internal library".

### 2. Renderer: split into two groups (`build-docs.mjs`)

- `collectConceptDocs` tags each concept `category: "workflow" | "internals"`;
  `buildPackageDocs` returns `concepts` (workflow) and `internalConcepts`
  separately (each sorted by `order` within its own category).
- **Overview** (`renderPackageOverview`): the "Concepts" grid renders only when
  non-empty; an "Internals" grid (with a short extension note) renders when
  internal concepts exist. Cards use a shared `renderConceptCard`.
- **Sidebar** (`renderSidebar`): an "Internals" sub-group is rendered under
  "Concepts" when `internalConcepts.length > 0`; "Reference" link unchanged.
- **Output paths**: workflow concepts write to `<pkg>/concepts/<slug>.html`,
  internals to `<pkg>/internals/<slug>.html`. Because they live in separate
  directories there is no slug collision across the two groups.
- **Href helpers**: a module-level `conceptDirFor(concept)` returns
  `"internals"` or `"concepts"`; the `conceptHref` nav lambdas build
  `./<dir>/<slug>.html` (on overview/reference pages) and
  `../<dir>/<slug>.html` (on concept pages, reaching siblings across groups).
  Concept page `currentHref` matches `nav.conceptHref(concept)` so the active
  highlight still works.
- **Manifest**: adds `internalConceptCount` alongside `conceptCount`.
- **Home** (`renderHome`): hero and every card rewritten to workflow-only.

### 3. Home page → workflow-only

- Hero: "Describe your application as intent — routes, inputs, responses,
  environment. Smite turns that description into a validated, typed server, and
  generates a client that matches it exactly." (drops "graph of descriptors /
  executors / bundle").
- Six cards, all workflow targets and none pointing into `@smitejs/core
  internals`:
  1. **Declarative HTTP** — "An API from a few lines of intent" →
     `smite-http/concepts/apps-and-routes.html`
  2. **Validated by construction** — "Inputs checked once, typed everywhere" →
     `smite-http/concepts/declared-inputs.html`
  3. **Typed client codegen** — "A client that matches your routes" →
     `smite-client/concepts/generating-a-typed-client.html`
  4. **Environment as code** ↔ `smite-env/concepts/registration.html`
  5. **Functional primitives** ↔ `smite-fp/concepts/composition.html`
  6. **Documented by tests** → `smite-http/reference.html`
- Package grid unchanged: `@smitejs/core` is a normal package card (per decision).
- The three old IR/registry cards (which linked to `descriptor-nodes` and
  `the-global-registry`) are removed; the home page no longer references
  internal concepts.

### 4. Rewrite workflow docs to usage-first

Stripped internal jargon ("IR", "descriptor", "registry", "globalRegistry",
"childrenOf", "finalizeDescriptor", "relate", "collect mode",
"ALLOW_GLOBAL_REGISTRY", "the IR node") from:

- `packages/http/docs/concepts/apps-and-routes.md` — describe
  `http.app()` → `http.router()` → `serve()`; drop "compiles down to the core
  IR" and the `childrenOf`-centric "graph looks like" section.
- `packages/http/docs/concepts/serving.md` — "walks the IR via child refs,
  never the registry" → "freezes the app into a stable, read-only structure";
  drop `finalizeDescriptor(app)`.
- `packages/http/docs/concepts/endpoints-and-handlers.md` — "adds an
  `http.endpoint` node" / "handler is just data stored on the IR" →
  "declares an endpoint" / "the handler is just the function you wrote".
- `packages/http/docs/concepts/benchmarking.md` — "identical route graph" →
  "identical routes"; "ALLOW_GLOBAL_REGISTRY folded out" → "bundled in
  production mode, so the measured handler is the exact shape your app ships".
- `packages/client/docs/concepts/codegen.md` — "collect mode / registered IR /
  lookupAll('app')" → "reads the declared routes and endpoints".
- `packages/client/docs/concepts/generated-api.md` — "mirrors the route graph"
  → "mirrors your routes".
- `packages/client/docs/concepts/runtime.md` — "no registry, no IR" → "Just
  HTTP — no server package, no framework, no magic".
- `packages/env/docs/concepts/registration.md` — "Collect-mode manifest" →
  "Build-time manifest"; drop "env.var descriptor in the global registry".
- `packages/http/docs/index.md`, `packages/client/docs/index.md`,
  `packages/env/docs/index.md` — same de-jargon sweep incl. the "generate walks
  globalThis.globalRegistry" and "serve walks the IR via child refs" notes.

Where a behavior is genuinely build-time (client codegen "runs once at build
time", env "build-time manifest"), it is kept but phrased in workflow terms.

### 5. Core package reframing

`packages/core/docs/index.md` is rewritten as the **internal library** landing:
states explicitly that app builders do not need `@smitejs/core` (reach for http/
env/client) and that this is the surface for extenders — the five internals
concepts, plus the registrar usage sample.

### 6. `AGENTS.md`

Updated the `docs:build` bullet to document the `concepts/internals/`
subfolder convention and the "Concepts" vs "Internals" groups.

## Implementation steps

1. Create `packages/core/docs/concepts/internals/` and move the five core
   concept files into it.
2. `scripts/build-docs.mjs`:
   - `collectConceptDocs`: tag `category` by path segment.
   - `buildPackageDocs`: split `concepts` / `internalConcepts`.
   - `writePackageDocs`: emit internals to an `internals/` dir.
   - `renderPackageOverview` / `renderSidebar`: conditional Concepts +
     Internals groups; `renderConceptCard`; `conceptDirFor` helper.
   - `renderConceptPage` / `renderReferencePage`: category-aware
     `conceptHref` (+ `currentHref` on concept pages).
   - `renderManifest`: `internalConceptCount`.
   - `renderHome`: new hero + six workflow cards.
3. Rewrite http/client/env `docs/concepts/*.md` and `docs/index.md` (step 4
   above).
4. Rewrite `packages/core/docs/index.md` as the internals landing.
5. Update the `AGENTS.md` docs bullet.
6. Close the feature slice (this file).

## Edge cases & error handling

- **Empty groups**: the Concepts grid only renders when workflow concepts
  exist; Internals only when internals exist. `@smitejs/core` shows only the
  Internals section (correct).
- **Slug collision**: workflow and internal pages write to different
  directories (`concepts/` vs `internals/`), so equal titles cannot collide.
- **Active nav highlight**: concept-page `currentHref` equals
  `nav.conceptHref(concept)` (both `../<dir>/<slug>.html`), keeping the
  `active` class correct from either directory depth.
- **Home page drops**: the hand-authored cards previously linked internal
  concept slugs; they are removed. Build-time `@example` resolution is
  unaffected; concept files keep their existing `@example <Title>` lines.
- **docs.test.ts**: checks `@example`→`#section` resolution in `src/`, which
  concept-file moves do not touch (verified: suites pass).

## Verification

- `yarn build` — `tsc -b` unchanged, green.
- `yarn test` — all suites green (97 tests), including the five per-package
  `docs.test.ts`.
- `yarn docs:build` — `dist/docs/smite-core/` contains `internals/` (five
  pages) and no `concepts/` entries; `smite-core/index.html` shows no
  "Concepts" section and an "Internals" section; `smite-http/…`, `smite-env/…`,
  `smite-client/…` show no "Internals"; home shows no cards pointing into core
  internals.
- `yarn format && yarn biome check .` — only the five known pre-existing
  violations remain (registry.ts, fp noArguments, serverless anys).

Definition of done: IR/descriptor topics live under **Internals**; workflow
docs no longer lead with implementation jargon; the home page is workflow-only;
and a fresh agent following `AGENTS.md` understands the split.

## Dependencies / prerequisites

- Slices `01`–`18` (all IR + docs platform behavior).
- `scripts/snippets.mjs`'s recursive `collectFiles`.

## Notes / open questions

- Broader internals (e.g. `@smitejs/http` DSL internals or `@smitejs/fp`
  extractor metadata) could also move under `internals/`; this slice moves the
  core IR only and leaves the convention general.
- "Not public API" is docs-taxonomy-only here. If a future slice de-exports
  the IR from `@smitejs/core`, the `@internal` JSDoc belongs in that slice.
- `docs.test.ts` does not assert the Internals/Concepts split; the convention
  is enforced by convention + code review. A test asserting that every
  `internals/` concept renders could be added later.