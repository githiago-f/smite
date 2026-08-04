---
title: Developing locally
summary: The `smite dev` loop: generators, a node:http server, and auto-reload.
order: 10
---

`smite dev` is the local-development loop for a single app. It replaces the
hand-rolled `createServer` boilerplate of the first examples with one command
that regenerates, bundles, serves, and reloads.

## What it does

1. Loads `smite.config.ts` and compiles the app entries in collect mode.
2. Runs every plugin in the config — typed client, OpenAPI, anything you add.
3. Bundles a runtime server over `node:http` and spawns it as a child
   `node` process.
4. Watches the sources; on change it re-runs the generators, rebundles with
   esbuild, and restarts the server.

## Keeping the CLI free of generators

`@smitejs/cli` never imports `@smitejs/http` or the generator packages. The dev
server is a generated entry that imports your app and `serveNode` from the
packages you installed; esbuild bundles it at `ALLOW_GLOBAL_REGISTRY: "false"`
and a child process runs it. The watcher skips generated artifacts
(`*.client.ts`, `openapi.json`) so regeneration never re-triggers a rebuild.

@example Bundle a dev server entry

## Watching

The watcher fingerprints file mtimes and sizes on a poll interval — portable,
no native dependencies — and fires once per change batch.

@example Watch source files for changes

## Generators

Every plugin declared in the config runs on each cycle, in declaration order.

@example Run all configured plugins

## Extending the server

The scaffolded `src/server.ts` calls `serveNode` directly, so you can mount
extra routers (`docs`), rewrite requests (`transformRequest`), or swap the
listener — the dev loop and your production server share one adapter.
