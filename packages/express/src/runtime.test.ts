import { http, lifecycle } from "@smite/core";
import { describe, expect, it } from "vitest";
import { createExpressRuntime } from "./runtime.js";
import type { ExpressResponseLike, SmiteHttpContext } from "./types.js";

describe("createExpressRuntime", () => {
  it("adapts express requests into the internal HTTP context", async () => {
    // #section - Express runtime usage
    const ApiGuard = lifecycle.guard(
      "api-key",
      (context: SmiteHttpContext) =>
        context.request.headers["x-api-key"] === "local-dev",
    );
    const ParseBody = lifecycle.pipe("parse-body", (body: unknown) => ({
      ...(body as Record<string, unknown>),
      parsed: true,
    }));

    const controller = http
      .controller()
      .use(lifecycle.create().guards(ApiGuard).pipes(ParseBody))
      .path("/users")
      .routes(
        http.route.post("/", (context: SmiteHttpContext) => ({
          status: 201,
          body: context.request.body,
        })),
      );

    const runtime = createExpressRuntime({ controllers: [controller] });
    const response = createResponse();

    await runtime(
      {
        method: "POST",
        url: "/users",
        headers: { "x-api-key": "local-dev" },
        body: { name: "Lin" },
      },
      response,
      (error) => {
        throw error;
      },
    );

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ name: "Lin", parsed: true });
    // #endsection
  });

  it("short-circuits denied guards before executing the handler", async () => {
    let executed = false;
    // #section - open circuit with guards
    const Deny = lifecycle.guard("deny", () => false);
    const controller = http
      .controller()
      .use(Deny)
      .path("/users")
      .routes(
        http.route.get("/", () => {
          executed = true;
        }),
      );

    const runtime = createExpressRuntime({ controllers: [controller] });
    const response = createResponse();

    await runtime({ method: "GET", url: "/users" }, response, (error) => {
      throw error;
    });

    expect(executed).toBe(false);
    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: "Forbidden" });
    // #endsection
  });
});

const createResponse = (): ExpressResponseLike & { body?: unknown } => {
  const response: ExpressResponseLike & { body?: unknown } = {
    statusCode: 200,
    headersSent: false,
    status: (status) => {
      response.statusCode = status;
      return response;
    },
    json: (body) => {
      response.headersSent = true;
      response.body = body;
    },
    end: () => {
      response.headersSent = true;
    },
  };

  return response;
};
