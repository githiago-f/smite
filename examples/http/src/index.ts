import { http, lifecycle } from "@smitejs/core";
import type { HttpExecutionContext } from "@smitejs/core";

const ApiGuard = lifecycle.guard(
  "api-key",
  (context: HttpExecutionContext) =>
    context.request.headers["x-api-key"] === "local-dev",
);
const ParseUserBody = lifecycle.pipe(
  "parse-user-body",
  (body: unknown) => body ?? {},
);
const JsonErrors = lifecycle.filter("json-errors", (error: Error) => ({
  status: 400,
  body: {
    error: error.message,
  },
}));

const authenticated = lifecycle
  .create()
  .guards(ApiGuard)
  .pipes(ParseUserBody)
  .filters(JsonErrors);

export const listUsers = () => [
  { id: "1", name: "Ada Lovelace" },
  { id: "2", name: "Grace Hopper" },
];

export const createUser = async (context: HttpExecutionContext) => ({
  status: 201,
  body: {
    received: context.request.body,
  },
});

export const UsersController = http
  .controller()
  .use(authenticated)
  .path("/users")
  .routes(http.route.get("/", listUsers), http.route.post("/", createUser));

export const controllers = [UsersController];
