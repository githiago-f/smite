# @smite/core

The internal library: nodes, edges, the global registry, and the compile-time
flag. Everything else in Smite builds on these primitives. If you are extending
Smite — writing a transport, a codegen tool, or new middleware — this is your
surface. If you are building an app, you do not need to touch it; reach for
`@smite/http`, `@smite/env`, and `@smite/client` instead.

Run the tests in `src/index.test.ts` for the executable contract.

## Internals

- **Descriptor nodes** — `defineDescriptor(kind, key, data)` returns a
  `Descriptor` (`{ __kind, __key, data }`, data frozen). The node is
  registered only in collect mode.
- **Edges and child indexes** — `relate(from, relation, to)` returns a
  `RelationshipDescriptor` and attaches `from`'s child index.
  `childrenOf(from, relation?)` walks it.
- **The global registry** — `register`/`lookup`/`lookupAll`/`relationships`/
  `clear` over `globalThis.globalRegistry`, gated by `ALLOW_GLOBAL_REGISTRY`.
- **The app junction** — `createApp(name?)` roots the graph (`kind: "app"`).
- **Immutability** — `refine(descriptor, patch)` replaces `data` with a frozen
  shallow merge; `finalizeDescriptor(root)` deep-freezes the reachable subtree.

## Usage

```ts
import {
  createApp,
  defineDescriptor,
  finalizeDescriptor,
  relate,
  childrenOf,
} from "@smite/core";

const app = createApp("my-app");
const route = defineDescriptor("http.route", "GET /ping", {});
relate(app, "http.route", route);

finalizeDescriptor(app);
childrenOf(app, "http.route"); // [route]
```
