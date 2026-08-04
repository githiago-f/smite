import { http } from "@smite/http";

export const app = http.app("admin");

const routes = http.route(app);
routes
  .accept("GET", "/admin/stats")
  .handler(() => ({ status: 200, body: { ok: true } }));
