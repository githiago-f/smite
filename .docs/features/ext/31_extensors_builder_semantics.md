# 31. App extensors: builder semantics everywhere

## Goal

Establish the shared contract for the new app-extensor packages (`@smitejs/handlers`,
`@smitejs/jobs`, `@smitejs/messaging`, and the planned event-stream/source work):
**every declarative surface is a builder**, used to build many nodes/sources from
a small set of common building pieces. Plain config-object factories are not the
preferred shape.

## Rules (apply to all future extensor slices)

1. **`app`-rooted vanity DSL.** Each package exports a single namespace object
   (`handlers`, `jobs`, `messaging`, …) whose members return brick
   builders, not bare descriptors. Example: `messaging.source(app).cache()` and
   `.queue()` come from one `messaging.source` builder, not two config-object
   factories.

2. **Composition over one-shot factories.** Prefer the http shape —
   `http.app().router().accept().handler()` — a chain of small builders that
   attach IR nodes via `relate` as you go. Each chained method returns `this`
   (or a refined builder) so pieces compose and reuse.

3. **One common piece, many nodes.** When the work naturally has a shared piece
   (a store, a connection, a schema, a source), expose a builder around that piece
   that derives multiple nodes from it. E.g. an event `messaging.source` builder
   should derive `queue` and `stream` nodes from one shared `(app, name, from)`
   config rather than requiring separate top-level factories.

4. **Collectors stay read-only.** `jobsOf(app)`, `channelsOf(app)`, `routesOf`
   remain functions walking the IR; they observe, they never mutate. Any mutation
   path is a builder.

5. **Runtime presumes "no builders in prod".** Builders only run in collect
   mode; executors (`scheduler`, broker, hub, lambdaify) walk the finalized IR
   via child refs as today.

## Definition of done

- The new package exports ("`jobs`", "`messaging`", …) one namespace whose members
  are builders, and any "many nodes" surface is reached through a shared builder.
- No constructor-style or config-object-only API is required to declare a source,
  job, or channel.
- Existing collector + executor + docs tests pass; every new slice states the
  builder it adds and the shared piece it builds from.