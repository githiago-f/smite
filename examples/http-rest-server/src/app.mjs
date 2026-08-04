import { http } from "@smitejs/http";
import { z } from "zod";

/**
 * Build the app: two resources with validated params/query.
 *
 * @returns the app reference and its router
 */
export const buildApp = () => {
  const app = http.app("store");
  const route = http.route(app).req({
    query: z.object({ q: z.string().optional() }).partial(),
    params: z
      .object({ id: z.coerce.number(), postId: z.coerce.number() })
      .partial(),
  });

  route.accept("GET", "/").handler(() => ({ status: 200, body: { ok: true } }));

  route
    .accept("GET", "/users")
    .handler((ctx) => ({ status: 200, body: { q: ctx.query.q ?? null } }));

  route
    .accept("GET", "/users/:id")
    .handler((ctx) => ({ status: 200, body: { id: ctx.params.id } }));

  route.accept("GET", "/users/:id/posts/:postId").handler((ctx) => ({
    status: 200,
    body: { id: ctx.params.id, postId: ctx.params.postId },
  }));

  return { app, router: app.serve() };
};
