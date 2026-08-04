# @smitejs/client

Typed client generation for Smite HTTP apps. Build your server entry, run it
once at build time to discover the declared routes, and emit a TypeScript
client that mirrors them. The `@smitejs/cli` plugin is the normal user-facing
entry point.

## CLI workflow

Install the generator with `npm install -D @smitejs/client`. Add
`client({ outfile: "./src/app.client.ts" })` to the `plugins` array in
`smite.config.ts`, then run `npx smite generate client`. In a project created
by `create-smite-app`, use `npm run generate` to run all configured
generators.

The generated file is source code. Import it with `import { api, configure }
from "./app.client.js"`, configure its `baseUrl`, and call the route-shaped
`api` methods.

## Usage

```ts
import { generate } from "@smitejs/client";

const code = await generate({
  entry: "src/app.ts",
  outfile: "src/app.client.ts",
});
```

The generated module exports `configure()` and `api`:

```ts
import { configure, api } from "./app.client.js";

configure({ baseUrl: "https://api.example.com", fetch });

const user = await api.users.$id.$get({
  params: { id: "42" }, // required, typed: inferred from the path template
  query: { q: "ada" },  // loose optional bucket
  headers: { authorization: "Bearer x" },
});
// { status: 200, body: { id: "42" }, headers: Headers }
```

## API

- `generate(options)` — builds `entry`, executes it to discover the declared
  routes, and writes a typed client to `outfile`. Returns the generated source.
  - `options.alias` maps package names to source paths during the build.
  - `options.appName` disambiguates when more than one app is declared.

## Generated client

- One nested builder per path segment: `/users/:id` becomes
  `api.users.$id`. Non-identifier segments are emitted as quoted keys.
- Leaf builders expose `$method` calls (`$get`, `$post`, …). `ANY` endpoints
  are skipped with a warning.
- Each call takes a bucket of `{ params, query, headers, body, $config }`;
  `params` come from the path template and are required.
- Responses are `{ status, body, headers }` and never throw on non-2xx.
- `configure({ baseUrl, fetch })` sets the runtime defaults; per-call
  `$config` overrides them. The generated module imports only
  `@smitejs/client/runtime` — a small fetch layer, nothing else.

## Runtime

`@smitejs/client/runtime` provides the fetch layer: path templating, query
serialization (arrays become repeated params), JSON bodies with
`content-type: application/json`, and response parsing that falls back to raw
text when the body is not JSON.
