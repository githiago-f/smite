import { http } from "@smite/http";
import { z } from "zod";

export const app = http.app("openapi-fixture");

const routes = http.route(app).req({
  query: z.object({
    q: z.string().optional(),
    page: z.number().int().optional(),
  }),
  params: z.object({ id: z.string() }),
  body: z.object({ name: z.string() }),
});

routes
  .accept("GET", "/users/:id")
  .handler((ctx) => ({ status: 200, body: { id: ctx.params.id } }));
routes
  .accept("POST", "/users/:id")
  .handler((ctx) => ({ status: 201, body: ctx.body }));
routes
  .accept("GET", "/users/:id/posts/:postId")
  .handler((ctx) => ({ status: 200, body: ctx.params }));
routes.accept("GET", "/health").handler(() => ({ status: 200, body: "ok" }));
routes.accept("ANY", "/anything").handler(() => ({ status: 200, body: {} }));
