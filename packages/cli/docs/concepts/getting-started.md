---
title: Getting started
summary: Build and call your first Smite HTTP app in a few minutes.
order: 1
---

This is the shortest path from an empty directory to a running Smite app. Smite
uses a normal TypeScript project, then compiles the declarations in your app to
run generators and build the server entry.

## Create a project

Install the CLI in a new project with `npm install -D @smite/cli @smite/http
zod`, then create the starter files with `npx smite create hello-api`.

Move into the project with `cd hello-api` and install its dependencies with
`npm install`. The generated project includes `src/app.ts`, `src/server.ts`,
and `smite.config.ts`.

## Define an app

The app is a declaration: create an app, attach a route, describe its inputs,
and return a response from the handler.

@example Define a first HTTP app

The `query` schema is optional as a whole, and its `name` field is optional.
Inside the handler, `ctx.query.name` is already validated and typed.

## Start and call it

Start the development loop with `npm run dev`. It runs the configured
generators, bundles a local `node:http` server, and reloads it when source files
change.

Call the route from another terminal with `curl
http://127.0.0.1:3000/hello`. Add a query value with `curl
'http://127.0.0.1:3000/hello?name=Ada'`.

The response is `{ "message": "Hello, Ada!" }`. Invalid input is rejected by
the route schema before the handler runs.

## Add generated tools

Add the `client()` and `openapi()` plugins to `smite.config.ts`:

@example Configure the client plugin

Run `npm run generate` when the starter config provides that script, or run
`npx smite generate client` and `npx smite generate openapi` directly. The
client is written to `src/app.client.ts`; the OpenAPI document is written to
`openapi.json`.

Browse the generated API with `npm run dev`, then open
`http://127.0.0.1:3000/docs` when the OpenAPI plugin is mounted by the starter.

## Build for deployment

Run `npm run build` to generate artifacts and bundle the runtime entry into
`dist/`. The deployment bundle has descriptor collection disabled; it contains
the runtime application, not the compile-time registry.

## Output while developing

CLI commands print human-readable output by default. `npx smite dev` streams
the local server output directly and reports generator rebuilds as terminal
messages.
