# create-smite-app

Scaffold a new Smite application in one command:

```bash
yarn create smite-app my-app
```

This installs and runs the `create-smite-app` bin, which delegates to
`@smitejs/cli`'s `createApp`. It writes a starter project into `./my-app/` and
prints the next steps.

The complete first-project path is documented in
[`Create your first project`](./concepts/create-your-first-project.html):
scaffold with `yarn create smite-app`, install with `npm install`, start with
`npm run dev`, and call the starter with `curl`.

## Templates

Pass `--template <name>` to choose the starter. Available templates:

- `http` — an app + server with Swagger UI, client and OpenAPI codegen, a
  Vitest suite, a Biome config, and a Docker compose service (the default).
- `serverless` — the same tested app served through the API Gateway v2 Lambda
  adapter and deployable with the Serverless Framework.

```bash
yarn create smite-app my-app --template serverless
```

`--force` overwrites an existing directory.

## What you get

The scaffolded project has a `package.json`, a `tsconfig.json`, a
`smite.config.ts` declaring the generator plugins, TypeScript sources
(`src/app.ts` + `src/server.ts` on the `http` template), a README, and a
`.gitignore`. `npm run dev` runs `smite dev` (generators + local server +
auto-reload), `npm run generate` runs the generators once, `npm start` serves
the app with Swagger UI at `/docs`, `npm test` runs the app's own Vitest
suite, and `npm run typecheck` runs `tsc --noEmit`.
