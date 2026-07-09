import { createApplication, http, lifecycle } from "@smite/core";
import { describe, expect, it } from "vitest";
import { createExpressRuntime } from "./runtime.js";
import type { ExpressResponseLike, SmiteHttpContext } from "./types.js";

describe("multi-controller routing", () => {
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

  const UsersController = http
    .controller()
    .path("/users")
    .routes(
      http.route.get("/", () => ({ body: { resource: "users", action: "list" } })),
      http.route.post("/", () => ({ status: 201, body: { resource: "users", action: "create" } })),
      http.route.get("/search", (ctx: SmiteHttpContext) => ({
      body: { resource: "users", action: "search", query: ctx.request.query },
    })),
    );

  const BillingController = http
    .controller()
    .path("/billing")
    .routes(
      http.route.get("/", () => ({ body: { resource: "billing", action: "list" } })),
      http.route.get("/invoices", () => ({ body: { resource: "billing", action: "invoices" } })),
    );

  const HealthController = http
    .controller()
    .path("/health")
    .routes(
      http.route.get("/", () => ({ body: { status: "ok" } })),
    );

  const runtime = createExpressRuntime({
    application: createApplication().add(
      UsersController,
      BillingController,
      HealthController,
    ),
  });

  it("routes GET /users to UsersController", async () => {
    const res = createResponse();
    await runtime({ method: "GET", path: "/users" }, res, (e) => { throw e; });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ resource: "users", action: "list" });
  });

  it("routes POST /users to UsersController (different method)", async () => {
    const res = createResponse();
    await runtime({ method: "POST", path: "/users" }, res, (e) => { throw e; });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ resource: "users", action: "create" });
  });

  it("routes GET /users/search?q=ada to UsersController with query params", async () => {
    const res = createResponse();
    await runtime(
      { method: "GET", path: "/users/search", query: { q: "ada" } },
      res,
      (e) => { throw e; },
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ resource: "users", action: "search", query: { q: "ada" } });
  });

  it("routes GET /billing to BillingController", async () => {
    const res = createResponse();
    await runtime({ method: "GET", path: "/billing" }, res, (e) => { throw e; });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ resource: "billing", action: "list" });
  });

  it("routes GET /billing/invoices to BillingController", async () => {
    const res = createResponse();
    await runtime({ method: "GET", path: "/billing/invoices" }, res, (e) => { throw e; });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ resource: "billing", action: "invoices" });
  });

  it("routes GET /health to HealthController", async () => {
    const res = createResponse();
    await runtime({ method: "GET", path: "/health" }, res, (e) => { throw e; });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns 404 for unmatched path", async () => {
    const res = createResponse();
    await runtime({ method: "GET", path: "/nonexistent" }, res, (e) => { throw e; });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for valid path but wrong method", async () => {
    const res = createResponse();
    await runtime({ method: "DELETE", path: "/billing/invoices" }, res, (e) => { throw e; });
    expect(res.statusCode).toBe(404);
  });

  it("does not confuse similar paths - /users/search vs /users", async () => {
    const listRes = createResponse();
    const searchRes = createResponse();

    await runtime({ method: "GET", path: "/users" }, listRes, (e) => { throw e; });
    await runtime({ method: "GET", path: "/users/search" }, searchRes, (e) => { throw e; });

    expect(listRes.body).toEqual({ resource: "users", action: "list" });
    expect(searchRes.body).toEqual({ resource: "users", action: "search", query: {} });
  });

  it("accepts Express-style url (with originalUrl) over path", async () => {
    const res = createResponse();
    await runtime(
      { method: "GET", originalUrl: "/billing", url: "/billing", path: "/billing" },
      res,
      (e) => { throw e; },
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ resource: "billing", action: "list" });
  });
});