import { readFile } from "node:fs/promises";
import { serveNode } from "@smitejs/http";
import { swaggerUi } from "@smitejs/openapi";
import { app } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

const openapi = JSON.parse(
  await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
);
const swagger = swaggerUi({ doc: openapi, title: "{{Title}}" });

const server = serveNode(app, {
  docs: { router: swagger, paths: ["/docs", "/openapi.json"] },
});
server.listen(port, host, () => {
  console.log(`listening on http://${host}:${port}`);
  console.log(`- API docs:     http://${host}:${port}/docs`);
  console.log(`- OpenAPI spec: http://${host}:${port}/openapi.json`);
});
