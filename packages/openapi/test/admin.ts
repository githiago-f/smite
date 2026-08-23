import { http } from "@smitejs/http";

export const app = http.app("admin-fixture");

const routes = http.router();
routes
  .accept("GET", "/admin/stats")
  .handler(() => ({ status: 200, body: { ok: true } }));
app.use(routes);
