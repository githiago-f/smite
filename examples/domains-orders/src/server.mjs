import { createServer } from "node:http";
import { buildApp } from "./app.mjs";

const PORT = Number(process.env.PORT ?? 3000);
const { router } = buildApp();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }
  const response = await router({
    method: req.method ?? "GET",
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: req.headers,
    cookies: {},
    params: {},
    body: body.length > 0 ? JSON.parse(body) : undefined,
  });
  const payload = JSON.stringify(response.body ?? null);
  res.writeHead(response.status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
});

server.listen(PORT, () => {
  console.log(`@smite/domain example listening on http://127.0.0.1:${PORT}`);
  console.log(
    "POST /orders   →",
    'curl -X POST http://127.0.0.1:3000/orders -d \'{"sku":"jersey","qty":2}\'',
  );
  console.log("GET /orders/:id →", "curl http://127.0.0.1:3000/orders/<id>");
});
