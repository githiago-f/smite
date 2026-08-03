import { createServer } from "node:http";
import { env } from "@smite/env";
import { http } from "@smite/http";
import { z } from "zod";

const config = env
  .register({
    port: {
      key: "PORT",
      validation: z.coerce.number().int().positive(),
    },
    greeting: {
      key: "GREETING",
      validation: z.string().min(1),
    },
  })
  .withProvider((key) => Promise.resolve(process.env[key]), {
    cache: true,
  });

const bootstrap = async () => {
  const [port, greeting] = await Promise.all([config.port, config.greeting]);

  const app = http.app("greeter");
  const route = http.route(app);
  route.accept("GET", "/").handler(() => ({
    status: 200,
    body: { greeting },
  }));

  const router = app.serve();
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
    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(JSON.stringify(response.body ?? null));
  });

  server.listen(port, () => {
    console.log(`env+http example listening on http://127.0.0.1:${port}`);
  });
};

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
