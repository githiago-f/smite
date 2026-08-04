import { access, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * The starter templates available to {@link createApp}.
 *
 * @group Create
 */
export type CreateTemplate = "default" | "minimal";

/**
 * Options for {@link createApp}.
 *
 * @group Create
 */
export interface CreateAppOptions {
  /** The app name; also the directory name and npm package name. */
  readonly name: string;
  /** Base directory to scaffold into. Defaults to `process.cwd()`. */
  readonly baseDir?: string;
  /** Starter template. Defaults to `"default"`. */
  readonly template?: CreateTemplate;
  /** Overwrite an existing non-empty directory. Defaults to `false`. */
  readonly force?: boolean;
}

/**
 * Lists the available starter templates.
 *
 * @group Create
 * @example List the starter templates
 */
export const listTemplates = (): readonly CreateTemplate[] =>
  Object.keys(TEMPLATES) as readonly CreateTemplate[];

const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^[._-]+|[._-]+$/gu, "");
  if (slug.length === 0) {
    throw new Error(`Invalid app name '${value}'.`);
  }
  return slug;
};

const render = (source: string, name: string): string =>
  source.replaceAll("{{name}}", name).replaceAll("{{Title}}", toTitle(name));

const toTitle = (name: string): string =>
  name
    .split(/[-_.]+/u)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");

const PACKAGE_JSON = `{
  "name": "{{name}}",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "generate": "smite generate client && smite generate openapi",
    "dev": "smite dev",
    "start": "node src/server.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@smite/cli": "latest",
    "@smite/client": "latest",
    "@smite/http": "latest",
    "@smite/openapi": "latest",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.4"
  }
}
`;

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "smite.config.ts"]
}
`;

const SMITE_CONFIG = `import { defineSmiteConfig } from "@smite/cli";
import { client } from "@smite/client";
import { openapi } from "@smite/openapi";

export default defineSmiteConfig({
  entries: ["./src/app.ts"],
  plugins: [
    client({ outfile: "./src/app.client.ts" }),
    openapi({ outfile: "./openapi.json", title: "{{Title}}" }),
  ],
});
`;

const MINIMAL_PACKAGE_JSON = `{
  "name": "{{name}}",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "generate": "smite generate client",
    "dev": "smite dev",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@smite/cli": "latest",
    "@smite/client": "latest",
    "@smite/http": "latest",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.4"
  }
}
`;

const MINIMAL_SMITE_CONFIG = `import { defineSmiteConfig } from "@smite/cli";
import { client } from "@smite/client";

export default defineSmiteConfig({
  entries: ["./src/app.ts"],
  plugins: [client({ outfile: "./src/app.client.ts" })],
});
`;

const APP_SOURCE = `import { http } from "@smite/http";
import { z } from "zod";

export const app = http.app("{{name}}");

const routes = http.route(app).req({
  query: z.object({ q: z.string().optional() }).partial(),
  params: z.object({ id: z.coerce.number() }).partial(),
  body: z.object({ title: z.string().min(1) }).optional(),
});

routes
  .accept("GET", "/health")
  .handler(() => ({ status: 200, body: { ok: true } }));

routes
  .accept("GET", "/items")
  .handler((ctx) => ({ status: 200, body: { q: ctx.query.q ?? null } }));

routes
  .accept("GET", "/items/:id")
  .handler((ctx) => ({ status: 200, body: { id: ctx.params.id } }));

routes
  .accept("POST", "/items")
  .handler((ctx) => ({ status: 201, body: { title: ctx.body?.title } }));
`;

const SERVER_SOURCE = `import { serveNode } from "@smite/http";
import { swaggerUi } from "@smite/openapi";
import { readFile } from "node:fs/promises";
import { app } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

const doc = JSON.parse(
  await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
);

const server = serveNode(app, {
  docs: {
    router: swaggerUi({ doc, title: "{{Title}}" }),
    paths: ["/docs", "/openapi.json"],
  },
});

server.listen(port, host, () => {
  console.log(\`listening on http://\${host}:\${port}\`);
  console.log(\`- API docs:     http://\${host}:\${port}/docs\`);
  console.log(\`- OpenAPI spec: http://\${host}:\${port}/openapi.json\`);
});
`;

const README = `# {{Title}}

A Smite application scaffolded with \`smite create\`, written in TypeScript.

## Setup

\`\`\`bash
npm install
\`\`\`

## Develop

\`\`\`bash
npm run dev
\`\`\`

\`npm run dev\` runs \`smite dev\`, which:

1. Runs the generators in \`smite.config.ts\` (typed client, OpenAPI).
2. Bundles a local server over \`node:http\` and serves the app.
3. Watches the sources; on change it re-runs the generators, rebundles, and
   restarts the server.

## Scripts

- \`npm run generate\` — \`smite generate client\` writes \`src/app.client.ts\`;
  \`smite generate openapi\` writes \`openapi.json\`.
- \`npm run start\` — serves the app in production via \`src/server.ts\`
  (built on \`@smite/http\`'s \`serveNode\`, with Swagger UI at \`/docs\`).
- \`npm run typecheck\` — \`tsc --noEmit\`.

## Endpoints

- \`GET http://127.0.0.1:3000/items\`
- \`GET http://127.0.0.1:3000/items/42\`
- \`POST http://127.0.0.1:3000/items\` with \`{"title":"Hello"}\`
- API docs: \`http://127.0.0.1:3000/docs\`
- OpenAPI spec: \`http://127.0.0.1:3000/openapi.json\`
`;

const MINIMAL_README = `# {{Title}}

A minimal Smite application scaffolded with \`smite create --template minimal\`.

## Setup

\`\`\`bash
npm install
npm run generate
\`\`\`

\`npm run generate\` runs \`smite generate client\`, which writes
\`src/app.client.ts\` — a typed, builder-style client mirroring the routes in
\`src/app.ts\`.

\`npm run dev\` runs \`smite dev\`: it regenerates the client, serves the app
locally over \`node:http\`, and restarts on change. The app itself can also be
served however you like; this template ships no dedicated server file.
`;

const GITIGNORE = `node_modules/
dist/
src/app.client.ts
openapi.json
`;

type TemplateFiles = ReadonlyArray<readonly [string, string]>;

interface Template {
  readonly description: string;
  readonly files: TemplateFiles;
}

const TEMPLATES: Readonly<Record<CreateTemplate, Template>> = {
  default: {
    description:
      "Full starter: app + server with Swagger UI, client and OpenAPI codegen.",
    files: [
      ["package.json", PACKAGE_JSON],
      ["tsconfig.json", TSCONFIG],
      ["smite.config.ts", SMITE_CONFIG],
      ["src/app.ts", APP_SOURCE],
      ["src/server.ts", SERVER_SOURCE],
      ["README.md", README],
      [".gitignore", GITIGNORE],
    ],
  },
  minimal: {
    description:
      "Minimal starter: app + typed client only, no server or OpenAPI.",
    files: [
      ["package.json", MINIMAL_PACKAGE_JSON],
      ["tsconfig.json", TSCONFIG],
      ["smite.config.ts", MINIMAL_SMITE_CONFIG],
      ["src/app.ts", APP_SOURCE],
      ["README.md", MINIMAL_README],
      [".gitignore", GITIGNORE],
    ],
  },
};

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Scaffolds a starter application into `<baseDir>/<name>` from the selected
 * template: a `package.json`, a `smite.config.ts` declaring the generator
 * plugins, a runnable app (+ server with Swagger UI for the `default` template),
 * a README, and a `.gitignore`. Returns the created directory.
 *
 * @group Create
 * @example Scaffold a new application
 */
export async function createApp(options: CreateAppOptions): Promise<string> {
  const name = slugify(options.name);
  const baseDir = resolve(options.baseDir ?? process.cwd());
  const dir = join(baseDir, name);
  const templateName = options.template ?? "default";
  const template = TEMPLATES[templateName];
  if (template === undefined) {
    throw new Error(
      `Unknown template '${templateName}'. Available: ${listTemplates().join(", ")}.`,
    );
  }

  if ((await pathExists(dir)) && options.force !== true) {
    throw new Error(
      `Directory '${dir}' already exists. Pass force: true to overwrite.`,
    );
  }

  await mkdir(join(dir, "src"), { recursive: true });
  for (const [filePath, source] of template.files) {
    await writeFile(join(dir, filePath), render(source, name), "utf8");
  }
  return dir;
}
