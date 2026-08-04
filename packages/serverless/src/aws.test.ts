import { clear } from "@smitejs/core";
import { http } from "@smitejs/http";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { lambdaify } from "./aws.js";

afterEach(() => clear());

describe("@smitejs/serverless/aws", () => {
  it("adapts API Gateway v2 events to a Smite app", async () => {
    const app = http.app("lambda-fixture");
    const routes = http.route(app);
    routes.accept("GET", "/users/:id").handler((ctx) =>
      http.json({
        id: ctx.params.id,
        q: ctx.query.q,
        session: ctx.request.cookies.session,
      }),
    );

    // #section - Lambdaify an app
    const handler = lambdaify(app);
    // #endsection

    const response = await handler({
      version: "2.0",
      rawPath: "/users/42",
      rawQueryString: "q=ada",
      cookies: ["session=abc"],
      requestContext: { http: { method: "GET", path: "/users/42" } },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      id: "42",
      q: "ada",
      session: "abc",
    });
    expect(response.headers["content-type"]).toBe(
      "application/json; charset=utf-8",
    );
  });

  it("parses JSON request bodies", async () => {
    const app = http.app("lambda-body");
    const routes = http.route(app);
    routes
      .req({ body: z.object({ name: z.string() }) })
      .accept("POST", "/users")
      .handler((ctx) => http.status(201).json({ name: ctx.body.name }));

    const response = await lambdaify(app)({
      rawPath: "/users",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ada" }),
      requestContext: { http: { method: "POST" } },
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual({ name: "Ada" });
  });

  it("returns zod validation failures as 400 responses", async () => {
    const app = http.app("lambda-validation");
    const routes = http.route(app);
    routes
      .req({ body: z.object({ name: z.string() }) })
      .accept("POST", "/users")
      .handler((ctx) => http.status(201).json(ctx.body));

    const response = await lambdaify(app)({
      rawPath: "/users",
      body: JSON.stringify({ name: 123 }),
      requestContext: { http: { method: "POST" } },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({
      error: expect.any(Array),
    });
  });

  it("preserves explicit response headers and text bodies", async () => {
    const app = http.app("lambda-headers");
    const routes = http.route(app);
    routes.accept("GET", "/health").handler(() => ({
      status: 200,
      headers: { "content-type": "text/plain" },
      body: "ok",
    }));

    const response = await lambdaify(app)({
      rawPath: "/health",
      requestContext: { http: { method: "GET" } },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/plain");
    expect(response.body).toBe("ok");
  });
});
