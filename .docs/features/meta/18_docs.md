# 18. The docs flow (`#section` → `@example` → reference site)

## Goal

Close the docs loop for every public API across all five live workspaces
(`fp`, `core`, `http`, `env`, `client`): tested `#section` snippets in test
files become `@example` JSDoc on public APIs and render as tested, shiki/
Catppuccin-highlighted reference pages on a static docs site. Enforce the
mapping per package so doc/code drift fails CI instead of shipping.

## Context

Slices 07/12 established the per-package `docs/index.md` + tests-as-runnable-
examples pattern; slice 14 built the top-level docs and `AGENTS.md`. The site
generator is the rich `jsdoc`/`shiki`/`catppuccin` builder (`build-docs.mjs`):
every public API carries `@group`/`@intent`/`@example <Title>` JSDoc that
resolves to a tested `#section` snippet, and snippets with an expected result
render a Code/Result tab pair. `dist` injection (slice-era
`inject-jsdoc-examples.mjs`) is a separate, optional step that embeds the tested
snippets into the emitted declaration comments.

## Design

### 1. Authoring: `#section` snippets in tests

Test files wrap real, executable examples:

```
// #section - Generate a typed client
const generated = await generate(/* ... */);
// #endsection
```

`scripts/snippets.mjs` (pre-existing) extracts them per package with
`collectTestSnippets({ packageName, rootDir, srcDir })`, keyed by
`normalizeExampleName(title)` (lowercased). It throws on nested or unclosed
sections and duplicate titles within a package. Public APIs then reference the
snippet by title:

```ts
/**
 * Generates a typed client from the app IR.
 *
 * @group Codegen
 * @example Generate a typed client
 */
export async function generate(options: GenerateOptions): Promise<void>;
```

### 2. Injection: `scripts/inject-jsdoc-examples.mjs`

`expandExamples(source, snippetIndex, packageName, filePath)` rewrites each
`* @example <Title>` line into a full `@example```ts … ```` block, embedding the
snippet body as a code fence. Guards:

- Unresolved titles throw (`- Missing tested snippet: <Title>`).
- A snippet whose code contains `*/` throws (it would close the JSDoc comment
  and corrupt the emitted declaration) — rewrite the snippet instead.

`main()` runs only when the module is executed directly (guarded by comparing
`import.meta.url` to `pathToFileURL(process.argv[1]).href`) so tests can import
`expandExamples`. It walks the publishable workspaces, collects each package's
snippets, and rewrites `*.d.ts`/`*.js` files under `dist` in place. Idempotent:
only writes when the output differs.

`scripts/release-workspaces.mjs`'s `collectPublishableWorkspaces` skips
directories under `packages/` that lack a `package.json` (the empty roadmap
dirs `cli`/`serverless`), and sorts by package name.

### 3. Per-package integrity test: `packages/*/src/docs.test.ts`

Each live package has a `docs.test.ts` that asserts:

1. Every `@example <Title>` in `src/**/*.ts` resolves to a tested `#section`
   snippet for that package.
2. `expandExamples` renders each snippet into a ` ```ts` fence whose first line
   matches the snippet's first line.

Adding or renaming an example without a matching section (or vice versa) fails
that package's suite. Keep these in sync when touching examples.

### 4. Static site: `scripts/build-docs.mjs` + `scripts/dev-docs.mjs`

`docs:build` (root script) reads package JSDoc from `src/**/*.ts` directly
(shiki/`@shikijs/themes`/`jsdoc` dev deps). Pipeline:

1. `collectPackages()` lists publishable workspaces; `collectTestSnippets()`
   extracts each package's `#section` snippets.
2. `extractApiDocs()` parses `/** … */` blocks preceding exported declarations,
   grouping them by `@group`/`@intent` and resolving every `@example <Title>`
   against the tested snippets.
3. Concept docs are rendered from `packages/*/docs/concepts/*.md` (frontmatter
   `order`/`title`/`summary`, inline `@example`/`@benchmark`); benchmarks render
   from `benchmarks/results/*.summary.json` when present. The renderer supports
   `@example` and `@benchmark` directives, headings, lists, and paragraphs —
   it does **not** render raw code fences. A raw ` ```ts ` fence throws at
   build time with a hint to use `@example <Title>` backed by a tested
   `#section` snippet; shell commands belong in inline backticks.
4. Shiki highlights every snippet with the Catppuccin theme; snippets that carry
   an expected result render a Code/Result tab pair.
5. Renders into `dist/docs/`: `index.html`, `styles.css`, `manifest.json`, and
   per-package `smite-*/index.html` + `smite-*/reference.html`. Concept pages
   land under `smite-*/concepts/`. Feature slices in `.docs/features/` are
   intentionally NOT part of the site — they are the implementation plan, not
   user docs.

`docs:dev` serves `dist/docs` on `127.0.0.1:4173` with a fingerprint watcher
over the build script, top-level docs, and all package sources; on change it
reruns the build. Missing files are tolerated when fingerprinting.

## Implementation steps

1. `scripts/inject-jsdoc-examples.mjs`: export `expandExamples`; guard
   `main()` behind direct-execution check; rework `collectPublishableWorkspaces`
   to skip dirs without `package.json`.
2. Author `#section` snippets + `@example`/`@group` JSDoc across
   `packages/{core,http,env,client}/src/*.ts` (fp already carried the pattern).
3. Add per-package `docs.test.ts` (identical shape, per-package name/snippet
   index).
4. Restore `scripts/build-docs.mjs` (the shiki/Catppuccin builder from slice 14
   lineage, adapted for the current workspace layout) and rewire
   `scripts/dev-docs.mjs` watcher (drop deleted `.docs` files, tolerate missing
   files, keep `127.0.0.1:4173`).
5. Add root scripts `docs:build`/`docs:dev`; `docs:inject` already existed.
6. Re-add `shiki`, `@shikijs/themes`, `jsdoc` dev deps.
7. Update `AGENTS.md` (slices 01–18, docs commands, per-package `docs.test.ts`).
8. Feature slice `18_docs.md` documents the flow (this file).

## Edge cases & error handling

- **`*/` in a snippet** corrupts the emitted declaration when injecting into
  `dist` — the injector throws with a rewrite hint (e.g. a cron `*/5`
  schedule).
- **Dangling `@example`** (no matching section) throws in the builder; the
  per-package `docs.test.ts` also catches it at test time.
- **Duplicate or nested sections** throw in `collectTestSnippets` (pre-existing
  behavior).
- **Stale `dist`**: `docs:build` reads `src` directly, so it needs no fresh
  build; `docs:inject` rewrites `dist` in place and should run after `yarn
  build`.
- **Empty roadmap dirs** (`packages/cli`, `packages/serverless`) must not crash
  workspace collection — they are skipped.
- **Features must stay out of the site** — the builder renders only packages;
  a future slice that adds user-facing roadmap docs should render them
  separately, not via the feature files.

## Verification

- `yarn build` — pure `tsc -b`, unchanged.
- `yarn test` — all suites green, including the 5 per-package `docs.test.ts`
  (93 tests total).
- `yarn docs:build` — produces `dist/docs/` with `index.html`, `manifest.json`,
  `styles.css`, and `smite-*/index.html` + `smite-*/reference.html`; reference
  pages contain `class="shiki"` blocks and Code/Result tab pairs; no `features/`
  output.
- `yarn docs:dev` — serves `/`, `/smite-core/`, `/smite-core/reference.html`,
  `/styles.css` at `200`; any `/features/*` path returns `404`.
- `yarn format && yarn biome check .` — only the known pre-existing violations
  remain (registry.ts, fp noArguments, http unused imports, serverless anys).

Definition of done: every public API across the live packages has a tested,
syntax-highlighted, rendered example on the shiki/Catppuccin site; feature
slices are excluded; and a fresh agent following `AGENTS.md` can run the docs
commands.

## Dependencies / prerequisites

- Slices `01`–`17` (all implemented behavior being documented).
- `@smitejs/fp`'s `snippets.mjs` (the `#section` extractor) and its reference
  `docs.test.ts` shape.

## Notes / open questions

- Keep `docs.test.ts` in sync with example renames; the test list is the
  canonical per-package roster of documented APIs.
- `docs:inject` is an optional, separate step for embedding tested snippets in
  `dist` declaration comments; it is not required for `docs:build`, which reads
  `src` directly.
