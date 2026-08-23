import { http } from "@smitejs/http";
import { z } from "zod";

export const app = http.app("fixture-api");

const routes = http.router().input({
  query: z.object({ q: z.string().optional(), page: z.number().optional() }),
});
routes.accept("GET", "/users").handler(() => ({ status: 200, body: [] }));
routes
  .accept("GET", "/users/:id")
  .handler((ctx) => ({ status: 200, body: { id: ctx.params.id } }));
routes
  .accept("POST", "/users")
  .handler((ctx) => ({ status: 201, body: ctx.body }));
routes
  .accept("GET", "/users/:id/posts/:postId")
  .handler((ctx) => ({ status: 200, body: ctx.params }));
routes.accept("GET", "/health").handler(() => ({ status: 200, body: "ok" }));
app.use(routes);
