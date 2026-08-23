import { http } from "@smitejs/http";

export const app = http.app("cli-fixture");

const routes = http.router();
routes.accept("GET", "/users").handler(() => ({ status: 200, body: [] }));
routes
  .accept("GET", "/users/:id")
  .handler((ctx) => ({ status: 200, body: { id: ctx.params.id } }));
routes
  .accept("POST", "/users")
  .handler((ctx) => ({ status: 201, body: ctx.body }));
routes.accept("GET", "/health").handler(() => ({ status: 200, body: "ok" }));
app.use(routes);
