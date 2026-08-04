import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serveNode } from "@smite/http";
import { swaggerUi } from "@smite/openapi";
import { app } from "./app.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const openapiFile = resolve(here, "../openapi.json");
const PORT = Number(process.env.PORT ?? 5000);

const doc = JSON.parse(await readFile(openapiFile, "utf8"));
const server = serveNode(app, {
  docs: {
    router: swaggerUi({ doc, title: "Pets API" }),
    paths: ["/docs", "/openapi.json"],
  },
});

server.listen(PORT, () => {
  console.log(`cli-app server listening on http://127.0.0.1:${PORT}`);
  console.log(`- API docs:     http://127.0.0.1:${PORT}/docs`);
  console.log(`- OpenAPI spec: http://127.0.0.1:${PORT}/openapi.json`);
  console.log(`- GET /pets/42: http://127.0.0.1:${PORT}/pets/42`);
});
