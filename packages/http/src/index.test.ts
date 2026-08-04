import { childrenOf, clear } from "@smitejs/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  http,
  HttpMethod,
  HttpStatus,
  cookies,
  getExtractorMetadata,
  headers,
  json,
  params,
  query,
  routesOf,
  serve,
  serveNode,
  status,
} from "./index.js";
import type { HttpRequest } from "./types.js";

afterEach(() => clear());

const makeRequest = (
  overrides: Partial<Omit<HttpRequest, "query" | "headers" | "params">> &
    Partial<Pick<HttpRequest, "query" | "headers" | "params">> = {},
): HttpRequest => ({
  method: "GET",
  path: "/",
  query: {},
  headers: {},
  cookies: {},
  params: {},
  body: undefined,
  ...overrides,
});

const makeApp = () => {
  const app = http.app();

  const route = http.route(app).req({
    query: z.object({ time: z.iso.date() }).partial(),
  });

  route
    .accept(HttpMethod.GET, "/users/:id")
    .handler((ctx) =>
      status(200).json({ id: ctx.params.id, time: ctx.query.time }),
    );

  route
    .accept(HttpMethod.GET, "/")
    .handler((ctx) => json({ time: ctx.query.time }));

  route.accept(HttpMethod.POST, "/").handler((ctx) => {
    const body = z.object({ name: z.string() }).safeParse(ctx.body);
    if (!body.success) {
      return status(HttpStatus.BAD_REQUEST).json({ error: body.error.issues });
    }
    return status(HttpStatus.CREATED).json({ name: body.data.name });
  });

  return { app, route, serve: app.serve() };
};

describe("http DSL", () => {
  it("exposes the node server adapter on the http namespace", () => {
    expect(http.serveNode).toBe(serveNode);
  });

  describe("IR wiring", () => {
    it("wires exactly one route to the app", () => {
      const { app, route } = makeApp();
      expect(childrenOf(app, "http.route")).toEqual([route]);
    });

    it("wires three endpoints to the route", () => {
      const { route } = makeApp();
      expect(childrenOf(route, "http.endpoint")).toHaveLength(3);
    });

    it("gives each endpoint exactly one handler child", () => {
      const { route } = makeApp();
      for (const endpoint of childrenOf(route, "http.endpoint")) {
        const handlers = childrenOf(endpoint, "http.handler");
        expect(handlers).toHaveLength(1);
        const handler = handlers[0];
        expect(handler?.data).toBeTypeOf("object");
        expect((handler?.data as { fn?: unknown }).fn).toBeTypeOf("function");
      }
    });

    it("hides the child index from Object.keys", () => {
      const { app, route } = makeApp();
      const endpoint = childrenOf(route, "http.endpoint")[0];
      const handler = endpoint
        ? childrenOf(endpoint, "http.handler")[0]
        : undefined;
      expect(Object.keys(app)).toEqual(["__kind", "__key", "data"]);
      expect(Object.keys(route)).toEqual(["__kind", "__key", "data"]);
      expect(Object.keys(endpoint ?? {})).toEqual(["__kind", "__key", "data"]);
      expect(Object.keys(handler ?? {})).toEqual(["__kind", "__key", "data"]);
    });
  });

  describe("dispatch", () => {
    it("matches /:id and passes the param and validated query", async () => {
      const { serve } = makeApp();
      const response = await serve(
        makeRequest({
          path: "/users/42",
          query: { time: "2024-01-01" },
        }),
      );
      expect(response).toEqual({
        status: 200,
        body: { id: "42", time: "2024-01-01" },
      });
    });

    it("serves GET /", async () => {
      const { serve } = makeApp();
      const response = await serve(
        makeRequest({ path: "/", query: { time: "2024-01-01" } }),
      );
      expect(response).toEqual({ status: 200, body: { time: "2024-01-01" } });
    });

    it("serves POST / with a valid body as 201", async () => {
      const { serve } = makeApp();
      const response = await serve(
        makeRequest({ method: "POST", path: "/", body: { name: "Alice" } }),
      );
      expect(response).toEqual({
        status: 201,
        body: { name: "Alice" },
      });
    });

    it("returns 400 for an invalid body", async () => {
      const { serve } = makeApp();
      const response = await serve(
        makeRequest({ method: "POST", path: "/", body: { name: 42 } }),
      );
      expect(response.status).toBe(400);
      expect(Array.isArray((response.body as { error: unknown }).error)).toBe(
        true,
      );
    });
  });

  describe("validation and errors", () => {
    it("returns 400 for an invalid query value", async () => {
      const { serve } = makeApp();
      const response = await serve(
        makeRequest({ path: "/", query: { time: "not-a-date" } }),
      );
      expect(response.status).toBe(400);
      expect(Array.isArray((response.body as { error: unknown }).error)).toBe(
        true,
      );
    });

    it("returns 404 for an unknown path", async () => {
      const { serve } = makeApp();
      const response = await serve(makeRequest({ path: "/unknown" }));
      expect(response).toEqual({ status: 404, body: { error: "Not Found" } });
    });

    it("returns 404 when the method does not match", async () => {
      const { serve } = makeApp();
      const response = await serve(
        makeRequest({ method: "DELETE", path: "/users/42" }),
      );
      expect(response).toEqual({ status: 404, body: { error: "Not Found" } });
    });
  });

  describe("junction guard", () => {
    it("throws on a second unnamed app", () => {
      http.app();
      expect(() => http.app()).toThrow(/app/);
    });
  });

  describe("immutability", () => {
    it("freezes the IR after serve", () => {
      const { route } = makeApp();
      const frozenRoute = route as { data: unknown };
      expect(Object.isFrozen(route)).toBe(true);
      expect(() => {
        frozenRoute.data = {};
      }).toThrow(TypeError);
    });
  });

  describe("extractors", () => {
    it("extracts a cookie, header, param, and query value", () => {
      const request = makeRequest({
        path: "/users/42",
        query: { tab: "profile" },
        headers: { "x-token": "tok-1" },
        cookies: { session_id: "abc123" },
        params: { id: "42" },
      });

      expect(cookies("session_id")(request).unwrapOr("missing")).toBe("abc123");
      expect(headers("x-token")(request).unwrapOr("missing")).toBe("tok-1");
      expect(params("id")(request).unwrapOr("missing")).toBe("42");
      expect(query("tab")(request).unwrapOr("missing")).toBe("profile");
    });

    it("returns none for absent values", () => {
      const request = makeRequest({});
      expect(cookies("session_id")(request).isNone()).toBe(true);
      expect(headers("x-token")(request).isNone()).toBe(true);
      expect(params("id")(request).isNone()).toBe(true);
      expect(query("tab")(request).isNone()).toBe(true);
    });

    it("chains extractors in order", () => {
      const request = makeRequest({
        headers: { "x-session-id": "header-id" },
      });
      const sessionId = http.chain(
        cookies("session_id"),
        headers("x-session-id"),
      );
      expect(sessionId(request).unwrapOr("missing")).toBe("header-id");
    });

    it("exposes extractor metadata for tooling", () => {
      const extractor = cookies("session_id");
      const metadata = getExtractorMetadata(extractor);
      expect(metadata).toEqual({
        kind: "fp.extractor",
        source: "cookie",
        key: "session_id",
      });
      expect(Object.keys(extractor)).toEqual([]);
    });
  });

  describe("documentation examples", () => {
    it("defines an app with routes", () => {
      // #section - Define an app with routes
      const app = http.app("store");
      const route = http.route(app);
      // #endsection

      expect(app.__kind).toBe("app");
      expect(route.__kind).toBe("http.route");
    });

    it("declares validated inputs on a route", () => {
      // #section - Declare validated inputs
      const app = http.app("wiki");
      const route = http.route(app).req({
        query: z.object({ language: z.string() }).partial(),
        params: z.object({ slug: z.string() }),
      });
      // #endsection

      expect(route.__kind).toBe("http.route");
    });

    it("adds endpoints and handlers", () => {
      // #section - Add endpoints and handlers
      const app = http.app("wiki");
      const route = http.route(app);
      route
        .accept("GET", "/pages/:slug")
        .handler((ctx) => json({ slug: ctx.params.slug }));
      // #endsection

      expect(childrenOf(route, "http.endpoint")).toHaveLength(1);
    });

    it("builds response bodies", () => {
      // #section - Build response bodies
      const ok = json({ ok: true });
      const created = status(201).json({ id: "42" });
      // #endsection

      expect(ok).toEqual({ status: 200, body: { ok: true } });
      expect(created).toEqual({ status: 201, body: { id: "42" } });
    });

    it("serves a request", async () => {
      // #section - Serve a request
      const app = http.app("store");
      const route = http.route(app);
      route.accept("GET", "/health").handler(() => json({ ok: true }));

      const router = serve(app);
      const response = await router({
        method: "GET",
        path: "/health",
        query: {},
        headers: {},
        cookies: {},
        params: {},
        body: undefined,
      });
      // #endsection

      expect(response).toEqual({ status: 200, body: { ok: true } });
    });

    it("collects an app's routes", () => {
      // #section - Collect an app's routes
      const app = http.app("store");
      const route = http.route(app).req({
        query: z.object({ q: z.string().optional() }).partial(),
      });
      route
        .accept("GET", "/users/:id")
        .handler((ctx) => json({ id: ctx.params.id }));
      const collected = routesOf(app);
      // #endsection

      expect(collected).toHaveLength(1);
      expect(collected[0]?.endpoints[0]?.pathParams).toEqual(["id"]);
    });

    it("chains extractors over a request", () => {
      // #section - Chain extractors over a request
      const resolve = (request: HttpRequest) =>
        http
          .chain(
            cookies("session_id"),
            headers("x-session-id"),
          )(request)
          .unwrapOr("anonymous");
      // #endsection

      expect(
        resolve({
          method: "GET",
          path: "/",
          query: {},
          headers: { "x-session-id": "abc123" },
          cookies: {},
          params: {},
          body: undefined,
        }),
      ).toBe("abc123");
      expect(
        resolve({
          method: "GET",
          path: "/",
          query: {},
          headers: {},
          cookies: { session_id: "cookie-id" },
          params: {},
          body: undefined,
        }),
      ).toBe("cookie-id");
    });
  });
});
