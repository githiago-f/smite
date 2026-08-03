import { createServer } from "node:http";
import { buildApp } from "./app.mjs";

const PORT = Number(process.env.PORT ?? 3000);
const { router } = buildApp();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const response = await router({
    method: req.method ?? "GET",
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: req.headers,
    cookies: {},
    params: {},
    body: undefined,
  });
  const body = JSON.stringify(response.body ?? null);
  res.writeHead(response.status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
});

server.listen(PORT, () => {
  console.log(`@smite/http example listening on http://127.0.0.1:${PORT}`);
  console.log("GET /users/42 →", "curl http://127.0.0.1:3000/users/42");
});
