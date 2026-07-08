import { describe, expect, it } from "vitest";
import { http, executeHttpPipeline, lifecycle } from "../index.js";
import type { HttpExecutionContext } from "../types.js";

describe("executeHttpPipeline", () => {
  it("executes lifecycle and handler in core order", async () => {
    const order: string[] = [];
    const Provider = lifecycle.provider("provider", () => {
      order.push("provider");
      return "provided";
    });
    const Guard = lifecycle.guard("guard", () => {
      order.push("guard");
      return true;
    });
    const Pipe = lifecycle.pipe("pipe", (body: unknown) => {
      order.push("pipe");
      return { ...(body as Record<string, unknown>), parsed: true };
    });
    const Interceptor = lifecycle.interceptor("interceptor", () => {
      order.push("interceptor");
    });
    const Filter = lifecycle.filter("filter", () => {
      order.push("filter");
    });

    const controller = http
      .controller()
      .use(
        lifecycle
          .create()
          .providers(Provider)
          .guards(Guard)
          .pipes(Pipe)
          .interceptors(Interceptor)
          .filters(Filter),
      )
      .path("/users")
      .routes(
        http.route.post("/", (context: HttpExecutionContext) => {
          order.push("handler");
          return {
            status: 201,
            body: {
              body: context.request.body,
              state: context.state,
            },
          };
        }),
      ).descriptor;

    const route = controller.routes[0];
    if (!route) {
      throw new Error("expected route to exist");
    }

    const result = await executeHttpPipeline(controller, route, {
      request: {
        method: "POST",
        path: "/users",
        headers: {},
        query: {},
        params: {},
        body: { name: "Lin" },
        raw: undefined,
      },
      state: {},
    });

    expect(order).toEqual([
      "provider",
      "guard",
      "pipe",
      "interceptor",
      "handler",
    ]);
    expect(result).toEqual({
      status: 201,
      body: {
        body: { name: "Lin", parsed: true },
        state: { provider: "provided" },
      },
    });
  });
});
