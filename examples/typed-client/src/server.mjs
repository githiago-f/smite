import { createServer } from "node:http";
import { app } from "./app.mjs";

const PORT = Number(process.env.PORT ?? 4000);
const router = app.serve();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let body;
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try {
      body = raw.length > 0 ? JSON.parse(raw) : undefined;
    } catch {
      body = undefined;
    }
  }
  const response = await router({
    method: req.method ?? "GET",
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: req.headers,
    cookies: {},
    params: {},
    body,
  });
  const out = JSON.stringify(response.body ?? null);
  res.writeHead(response.status, { "content-type": "application/json" });
  res.end(out);
});

server.listen(PORT, () => {
  console.log(`typed-client server listening on http://127.0.0.1:${PORT}`);
});
