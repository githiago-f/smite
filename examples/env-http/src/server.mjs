import { env } from "@smitejs/env";
import { http, serveNode } from "@smitejs/http";
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
  const route = http.router();
  route.accept("GET", "/").handler(() => ({
    status: 200,
    body: { greeting },
  }));
  app.use(route);

  const server = serveNode(app);
  server.listen(port, () => {
    console.log(`env+http example listening on http://127.0.0.1:${port}`);
  });
};

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
