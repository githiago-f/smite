# @smitejs/serverless

Runtime adapters for deploying Smite apps to serverless platforms.

## Serverless Framework

The `serverless()` plugin generates a `serverless.yml` from compiled Smite app
routes and exposes deployment through the installed Serverless Framework CLI:

```ts
import { serverless } from "@smitejs/serverless";

export default {
    entry: "./src/handler.ts",
  plugins: [
    serverless({
      service: "orders-api",
    }),
  ],
};
```

Functions are discovered from `entry`/`entries`: each entry becomes a function
named after its single named router (or after the file when it has no routers),
and receives only the routes that its entry registers. Declare one handler entry
per router to ship a lean, tree-shaken bundle per Lambda:

```ts
// src/handler-items.ts
import { lambdaify } from "@smitejs/serverless/aws";
import { app } from "./app.js";
import { addItems } from "./routers/items.js";

addItems(app);
export const handler = lambdaify(app);
```

```ts
// smite.config.ts
export default {
  entries: ["./src/handler-items.ts", "./src/handler-carts.ts"],
  plugins: [serverless({ service: "orders-api" })],
};
```

Use the optional `functions` map only when a function name, handler export, or
event mapping needs an override.

Run `smite build` to generate the runtime bundle and `serverless.yml`. Run
`smite deploy serverless` to generate the file and invoke `serverless deploy`.
Resources declared with `@smitejs/aws` become CloudFormation resources or
cross-stack imports, and explicit `requirePermissions` calls become
function-scoped IAM roles. The plugin currently targets AWS HTTP API events.

### Plugins, raw resources, and extensions

The `serverless()` options accept Serverless Framework plugins, raw
CloudFormation resources of any service, a `custom` block, and arbitrary
top-level keys. These are merged into the generated document, so resources
that are not modeled by `@smitejs/aws` (or infrastructure managed by a
Serverless Framework plugin) can be declared without a managed provider:

```ts
serverless({
  service: "orders-api",
  plugins: ["serverless-offline"],
  custom: { offline: { httpPort: 4000 } },
  resources: {
    Resources: {
      Distribution: {
        Type: "AWS::CloudFront::Distribution",
        Properties: { Enabled: true },
      },
    },
  },
  extend: {
    configValidationMode: "error",
    provider: { environment: { NODE_ENV: "production" } },
  },
});
```

- `plugins` — Serverless Framework plugins as package names or
  `{ localPath }` references, emitted into the `plugins` block.
- `resources` — raw CloudFormation template sections merged into the generated
  `resources` block. `Resources` entries are added alongside derived
  resources, and may override a generated logical id; other keys
  (`Outputs`, `Conditions`, `Mappings`, ...) are merged as well.
- `custom` — the `custom` block used to configure plugins.
- `extend` — arbitrary top-level `serverless.yml` keys merged last, so it can
  override anything the plugin generates (for example `provider` settings,
  `package`, or `layers`).

### CLI workflow

Install the deployment tools with `npm install -D @smitejs/serverless
serverless`. Add `serverless({ service: "orders-api" })` to `smite.config.ts`,
then run `npx smite build` to generate the runtime bundle and `serverless.yml`.
Preview or deploy with `npx serverless print` and `npx smite deploy serverless`.

Keep AWS credentials and region configuration in the environment used by the
Serverless Framework. Smite discovers functions from `entries`; it does not
require a second function list for the common case.

## Clients, docs, and local pipelines

`@smitejs/serverless` composes with `@smitejs/client` and `@smitejs/openapi`
two ways: a local CLI pipeline that generates artifacts and uploads them to a
provider-declared S3 bucket, or endpoints that serve the OpenAPI document and
Swagger UI from the deployed app. Both share the same `@smitejs/aws` providers,
so the bucket, its ARN, and its IAM permissions are declared once in code.

### Local artifact pipeline (`smite run`)

`@smitejs/cli` exposes `cli.exe("name", handler)`: a local command registered in
a source entry and callable with `smite run <name>`. The handler closes over the
app, the providers, and the generators, so it can produce the typed client and
the OpenAPI document and upload them to a bucket declared with `@smitejs/aws` —
using your local AWS credentials, never a Lambda.

Register the command in a dedicated entry that imports the app, the S3 provider,
and the generators:

```ts
// src/cli.ts
import { cli } from "@smitejs/cli";
import { generate } from "@smitejs/client";
import { openapi } from "@smitejs/openapi";
import { provider, logicalIdOf } from "@smitejs/aws";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { app } from "./app.js"; // registers + references the app so openapi() sees its routes

export const assets = provider(
  "s3",
  { name: "ClientAssets", bucketName: "orders-client-artifacts" },
  (ctx) => new S3Client({ region: ctx.region }),
);

cli.exe("publish:client", async () => {
  const code = await generate({
    entry: "./src/app.ts",
    outfile: "dist/client.ts",
  });
  await assets.client.send(
    new PutObjectCommand({
      Bucket: assets.descriptor.data.config.bucketName,
      Key: "client.ts",
      Body: code,
    }),
  );
  console.log(`Uploaded client.ts (${logicalIdOf(assets.descriptor)})`);
});

cli.exe("publish:docs", async () => {
  await openapi({ outfile: "dist/openapi.json" }).run({ apps: [app] });
});
```

Point `smite run` at the command entry with `cliEntries`, then run it from your
terminal. Commands are plain functions too, so you can call them from scripts:

```ts
// smite.config.ts
import { defineSmiteConfig } from "@smitejs/cli";
import { serverless } from "@smitejs/serverless";

export default defineSmiteConfig({
  entries: ["./src/handlers/api.ts"],
  cliEntries: ["./src/cli.ts"],
  plugins: [serverless({ service: "orders-api" })],
});
```

```bash
npx smite run publish:client
npx smite run publish:docs
```

The `serverless()` plugin emits the bucket (with a `<LogicalId>Arn` stack output
export, e.g. `orders-api-ClientAssets-Arn`) and the `requirePermissions` IAM
statements, so the pipeline and the deployed app share one provider definition.
The handler reads the physical bucket name from
`assets.descriptor.data.config` and the logical id from `logicalIdOf` — the
provider handle now exposes its `descriptor` so local tooling can resolve ARNs
and CloudFormation references without a second registry lookup.

### Expose /docs and /openapi.json

Generate the document with the `openapi` plugin, then serve it behind a named
`docs` router with `swaggerUiFromFile`. Give the router its own handler entry so
it ships as a separate Lambda:

```ts
// src/docs.ts
import { http } from "@smitejs/http";
import { swaggerUiFromFile } from "@smitejs/openapi";

const docs = swaggerUiFromFile({ file: "openapi.json" });

export function addDocs(app: ReturnType<typeof http.app>): void {
  const routes = http.router({ name: "docs" });
  routes.accept("GET", "/docs").handler((ctx) => docs(ctx.request));
  routes.accept("GET", "/openapi.json").handler((ctx) => docs(ctx.request));
  app.use(routes);
}
```

```ts
// src/handlers/docs.ts
import { lambdaify } from "@smitejs/serverless/aws";
import { app } from "../app.js";
import { addDocs } from "../docs.js";

addDocs(app);
export const handler = lambdaify(app, { router: "docs" });
```

```ts
// smite.config.ts
export default defineSmiteConfig({
  entries: ["./src/handlers/api.ts", "./src/handlers/docs.ts"],
  plugins: [
    serverless({ service: "orders-api" }),
    openapi({ outfile: "openapi.json" }),
  ],
});
```

`GET /docs` returns the Swagger UI page and `GET /openapi.json` the raw
document; `lambdaify(app, { router: "docs" })` returns 404 for every other
route. The typed client from `@smitejs/client` targets the same routes, so
point its `configure({ baseUrl })` at the API Gateway URL after deploy.

## AWS Lambda

`@smitejs/serverless/aws` exports `lambdaify(app)`, which adapts a Smite HTTP app
to an AWS API Gateway v2 Lambda handler:

```ts
import { lambdaify } from "@smitejs/serverless/aws";
import { app } from "./app.js";

export const handler = lambdaify(app);
```

Pass a `router` name to split an app into one Lambda per named router. Each
handler then dispatches only that router's routes and returns 404 for every
other route:

```ts
export const items = lambdaify(app, { router: "items" });
export const carts = lambdaify(app, { router: "carts" });
```

The adapter converts the API Gateway event into Smite's `HttpRequest`, dispatches
through `@smitejs/http`'s `serve(app)`, and returns an API Gateway proxy response.
It supports path routing, query strings, headers, cookies, JSON request bodies,
and normal Smite validation failures.

## API

- `lambdaify(app, options?)` — returns an async API Gateway v2 handler; pass
  `{ router }` to serve only that named router.
- `ApiGatewayV2Event` — structural event type consumed by the adapter.
- `ApiGatewayResponse` — proxy response returned by the adapter.
- `ApiGatewayHandler` — handler type returned by `lambdaify`.
- `serverless(options)` — CLI plugin that generates `serverless.yml` and
  deploys through the Serverless Framework.
- `writeServerlessConfig(apps, options)` — writes the provider configuration
  without invoking deployment.

Local artifact pipelines are `@smitejs/cli` commands (`cli.exe`) declared in a
`cliEntries` entry and run with `smite run <name>`; they import the same
`@smitejs/aws` providers as the app.
