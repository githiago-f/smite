---
title: Create your first project
summary: Scaffold, install, run, and edit a Smite application.
order: 1
---

`create-smite-app` is the recommended first command. It creates a complete
project so you can see the application entry, the local server, and the CLI
configuration before adding your own features.

## Scaffold

Run `yarn create smite-app hello-api`, then enter the directory with `cd
hello-api`. The default template is `http`. Install dependencies with `npm
install`.

Choose a template with `yarn create smite-app <name> --template <name>`. Each
template ships the same tested `src/app.ts` routes (`GET /health`, `GET
/items`, `GET /items/:id`, `POST /items`) and an identical Vitest suite, and
differs in how the entry is served and which generators run:

| Template      | Serving                                       | Entry           | Generators               |
| ------------- | --------------------------------------------- | --------------- | ------------------------ |
| `http`        | `serveNode` on a `node:http` server          | `src/server.ts` | typed client + OpenAPI   |
| `serverless`  | `lambdaify` on API Gateway v2                | `src/handler.ts`| none                     |

The `http` template also mounts a Swagger UI at `/docs` and serves the OpenAPI
spec at `/openapi.json`; the `serverless` template keeps the same routes via
the Lambda adapter without a node server or OpenAPI example. Both accept `npm
run dev` for the auto-reloading local development loop.

## Serverless

The `serverless` template serves the same routes through the API Gateway v2
Lambda adapter: no node server, no OpenAPI example, and only the tested
Vitest suite. Use it when the function is deployed to AWS Lambda directly
rather than run as a Node process.

## Run the starter

Start the local development loop with `npm run dev`. The CLI generates the
configured artifacts, starts the local server, and watches source files.

Call the starter from another terminal with `curl
http://127.0.0.1:3000/health`. The `http` template also serves its Swagger UI
at `http://127.0.0.1:3000/docs`.

## Learn the generated files

Start with `src/app.ts`: this is where routes and handlers are declared. The
`smite.config.ts` file tells the CLI which generators to run. `src/server.ts`
is the explicit Node server entry used for production-style execution.

Run `npm run generate` to regenerate the typed client and OpenAPI document.
Run `npm run typecheck` to check the project without starting it. Run `npm run
build` to produce the deployment bundle.
