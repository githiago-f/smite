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

Functions are discovered from `entry`/`entries`; `src/orders.ts` becomes the
`orders` function and points to `dist/orders.handler` by default. Use the
optional `functions` map only when a function name, handler export, or event
mapping needs an override.

Run `smite build` to generate the runtime bundle and `serverless.yml`. Run
`smite deploy serverless` to generate the file and invoke `serverless deploy`.
Resources declared with `@smitejs/aws` become CloudFormation resources or
cross-stack imports, and explicit `requirePermissions` calls become
function-scoped IAM roles. The plugin currently targets AWS HTTP API events.

### CLI workflow

Install the deployment tools with `npm install -D @smitejs/serverless
serverless`. Add `serverless({ service: "orders-api" })` to `smite.config.ts`,
then run `npx smite build` to generate the runtime bundle and `serverless.yml`.
Preview or deploy with `npx serverless print` and `npx smite deploy serverless`.

Keep AWS credentials and region configuration in the environment used by the
Serverless Framework. Smite discovers functions from `entries`; it does not
require a second function list for the common case.

## AWS Lambda

`@smitejs/serverless/aws` exports `lambdaify(app)`, which adapts a Smite HTTP app
to an AWS API Gateway v2 Lambda handler:

```ts
import { lambdaify } from "@smitejs/serverless/aws";
import { app } from "./app.js";

export const handler = lambdaify(app);
```

The adapter converts the API Gateway event into Smite's `HttpRequest`, dispatches
through `@smitejs/http`'s `serve(app)`, and returns an API Gateway proxy response.
It supports path routing, query strings, headers, cookies, JSON request bodies,
and normal Smite validation failures.

## API

- `lambdaify(app)` — returns an async API Gateway v2 handler.
- `ApiGatewayV2Event` — structural event type consumed by the adapter.
- `ApiGatewayResponse` — proxy response returned by the adapter.
- `ApiGatewayHandler` — handler type returned by `lambdaify`.
- `serverless(options)` — CLI plugin that generates `serverless.yml` and
  deploys through the Serverless Framework.
- `writeServerlessConfig(apps, options)` — writes the provider configuration
  without invoking deployment.
