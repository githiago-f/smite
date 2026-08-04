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
hello-api`. The default template includes an HTTP app, a `src/server.ts`, a
typed client generator, and an OpenAPI generator.

Install dependencies with `npm install`.

For a smaller project, use `yarn create smite-app hello-api --template
minimal`. The minimal template keeps the app and typed client without the
server or OpenAPI example.

## Run the starter

Start the local development loop with `npm run dev`. The CLI generates the
configured artifacts, starts the local server, and watches source files.

Call the starter from another terminal with `curl
http://127.0.0.1:3000/health`. Open `http://127.0.0.1:3000/docs` when using the
default template.

## Learn the generated files

Start with `src/app.ts`: this is where routes and handlers are declared. The
`smite.config.ts` file tells the CLI which generators to run. `src/server.ts`
is the explicit Node server entry used for production-style execution.

Run `npm run generate` to regenerate the typed client and OpenAPI document.
Run `npm run typecheck` to check the project without starting it. Run `npm run
build` to produce the deployment bundle.
