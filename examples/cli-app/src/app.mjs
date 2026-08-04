import { http } from "@smite/http";
import { z } from "zod";

export const app = http.app("pets");

const route = http.route(app).req({
  query: z.object({ page: z.coerce.number().int().optional() }).partial(),
  params: z.object({ id: z.coerce.number() }).partial(),
  body: z.object({ name: z.string().min(1) }).optional(),
});

route
  .accept("GET", "/health")
  .handler(() => ({ status: 200, body: { ok: true } }));

route
  .accept("GET", "/pets")
  .handler((ctx) => ({ status: 200, body: { page: ctx.query.page ?? null } }));

route
  .accept("GET", "/pets/:id")
  .handler((ctx) => ({ status: 200, body: { id: ctx.params.id } }));

route
  .accept("POST", "/pets")
  .handler((ctx) => ({ status: 201, body: { name: ctx.body?.name } }));
