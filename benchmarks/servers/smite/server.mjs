import { createServer } from "node:http";
import { http } from "@smite/http";
import { z } from "zod";

const app = http.app("bench");
const route = http.route(app).req({
  query: z.object({ q: z.string().optional() }).partial(),
  params: z
    .object({ id: z.coerce.number().optional(), postId: z.string().optional() })
    .partial(),
});

route.accept("GET", "/").handler(() => ({ status: 200, body: { ok: true } }));

route.accept("GET", "/users").handler((ctx) => ({
  status: 200,
  body: { q: ctx.query.q ?? null, users: [] },
}));

route
  .accept("GET", "/users/:id")
  .handler((ctx) => ({ status: 200, body: { id: ctx.params.id } }));

route.accept("GET", "/users/:id/posts/:postId").handler((ctx) => ({
  status: 200,
  body: { id: ctx.params.id, postId: ctx.params.postId },
}));

const router = app.serve();

const parseQuery = (search) => {
  const out = {};
  if (search.length === 0) return out;
  for (const [key, value] of new URLSearchParams(search)) out[key] = value;
  return out;
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const response = await router({
    method: req.method ?? "GET",
    path: url.pathname,
    query: parseQuery(url.search),
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

server.listen(process.env.PORT ?? 8080, () => {
  console.log(`[smite] listening on ${process.env.PORT ?? 8080}`);
});
