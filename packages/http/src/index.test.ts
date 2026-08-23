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
  methods,
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

  const route = http.router().input({
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

  app.use(route);

  return { app, route, serve: app.serve() };
};

describe("http DSL", () => {
  it("exposes the node server adapter on the http namespace", () => {
    expect(http.serveNode).toBe(serveNode);
  });

  describe("IR wiring", () => {
    it("wires exactly one route to the app", () => {
      const { app } = makeApp();
      expect(childrenOf(app, "http.route")).toHaveLength(1);
    });

    it("wires three endpoints to the route", () => {
      const { app } = makeApp();
      const [route] = childrenOf(app, "http.route");
      expect(childrenOf(route, "http.endpoint")).toHaveLength(3);
    });

    it("wires many routes to an app, each scoped to its own key", () => {
      const app = http.app("shop");
      const users = http.router({ name: "users" });
      const orders = http.router();
      app.use(users, orders);
      const routes = childrenOf(app, "http.route");
      expect(routes).toHaveLength(2);
      expect(routes[0]?.__key).toContain("users");
      expect(routes[1]?.__key).not.toContain("users");
    });

    it("keeps route keys unique within an app", () => {
      const app = http.app("catalog");
      app.use(http.router({ name: "items" }));
      expect(() => app.use(http.router({ name: "items" }))).toThrow(
        /Duplicate/,
      );
    });

    it("rejects route names containing anything but letters", () => {
      const app = http.app("validation");
      expect(() => app.use(http.router({ name: "get orders" }))).toThrow(
        /only letters/,
      );
      expect(() => app.use(http.router({ name: "get-orders" }))).toThrow(
        /only letters/,
      );
      expect(() => app.use(http.router({ name: "getOrders2" }))).toThrow(
        /only letters/,
      );
    });

    it("stores route config on the route node for generators", () => {
      const app = http.app("docs");
      const route = http.router({
        name: "pages",
        summary: "Get pages",
        description: "Fetch and manage page resources.",
      });
      app.use(route);
      const descriptor = childrenOf(app, "http.route")[0];
      expect(descriptor?.data).toMatchObject({
        name: "pages",
        summary: "Get pages",
        description: "Fetch and manage page resources.",
      });
    });

    it("gives each endpoint exactly one handler child", () => {
      const { app } = makeApp();
      const [route] = childrenOf(app, "http.route");
      for (const endpoint of childrenOf(route, "http.endpoint")) {
        const handlers = childrenOf(endpoint, "http.handler");
        expect(handlers).toHaveLength(1);
        const handler = handlers[0];
        expect(handler?.data).toBeTypeOf("object");
        expect((handler?.data as { fn?: unknown }).fn).toBeTypeOf("function");
      }
    });

    it("hides the child index from Object.keys", () => {
      const { app } = makeApp();
      const [route] = childrenOf(app, "http.route");
      const endpoint = childrenOf(route, "http.endpoint")[0];
      const handler = endpoint
        ? childrenOf(endpoint, "http.handler")[0]
        : undefined;
      expect(Object.keys(app)).toEqual(["__kind", "__key", "data"]);
      expect(Object.keys(route ?? {})).toEqual(["__kind", "__key", "data"]);
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
      const { app } = makeApp();
      expect(Object.isFrozen(app)).toBe(true);
      expect(() => {
        (app as { data: unknown }).data = {};
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
      const routes = http.router();
      app.use(routes);
      // #endsection

      expect(app.__kind).toBe("app");
    });

    it("declares validated inputs on a route", () => {
      // #section - Declare validated inputs
      const app = http.app("wiki");
      const routes = http.router().input({
        query: z.object({ language: z.string() }).partial(),
        params: z.object({ slug: z.string() }),
      });
      app.use(routes);
      // #endsection

      expect(childrenOf(app, "http.route")).toHaveLength(1);
    });

    it("adds endpoints and handlers", () => {
      // #section - Add endpoints and handlers
      const app = http.app("wiki");
      const routes = http.router();
      routes
        .accept("GET", "/pages/:slug")
        .handler((ctx) => json({ slug: ctx.params.slug }));
      app.use(routes);
      // #endsection

      const [route] = childrenOf(app, "http.route");
      expect(childrenOf(route, "http.endpoint")).toHaveLength(1);
    });

    it("declares routes with methods", () => {
      // #section - Declare routes with methods
      const app = http.app("store");
      const routes = http.router();
      routes.get(
        "/users/:id",
        { params: z.object({ id: z.string() }) },
        (ctx) => json({ id: ctx.params.id }),
      );
      routes.post("/users", { body: z.object({ name: z.string() }) }, (ctx) =>
        status(201).json({ name: ctx.body.name }),
      );
      app.use(routes);

      const health = methods.get("/health", {}, () => json({ ok: true }));
      app.use(health);
      // #endsection

      const [route] = childrenOf(app, "http.route");
      expect(childrenOf(route, "http.endpoint")).toHaveLength(2);
      expect(childrenOf(app, "http.route")).toHaveLength(2);
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
      const routes = http.router();
      routes.accept("GET", "/health").handler(() => json({ ok: true }));
      app.use(routes);

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

    it("scopes saved requests to named routers", async () => {
      const app = http.app("store");
      const items = http.router({ name: "items" });
      items.accept("GET", "/items").handler(() => json({ scope: "items" }));
      const carts = http.router({ name: "carts" });
      carts.accept("GET", "/cart").handler(() => json({ scope: "carts" }));
      app.use(items, carts);

      const request = {
        method: "GET",
        query: {},
        headers: {},
        cookies: {},
        params: {},
        body: undefined,
      };
      const scoped = serve(app, { routers: ["carts"] });

      expect(await scoped({ ...request, path: "/cart" })).toEqual({
        status: 200,
        body: { scope: "carts" },
      });
      expect(await scoped({ ...request, path: "/items" })).toEqual({
        status: 404,
        body: { error: "Not Found" },
      });
    });

    it("collects an app's routes", () => {
      // #section - Collect an app's routes
      const app = http.app("store");
      const route = http.router().input({
        query: z.object({ q: z.string().optional() }).partial(),
      });
      route
        .accept("GET", "/users/:id")
        .handler((ctx) => json({ id: ctx.params.id }));
      app.use(route);
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

    it("composes a deployable HTTP app", async () => {
      const app = http.app("store");
      // #section - Compose a deployable HTTP app
      const routes = http.router();

      routes.accept("GET", "/health").handler(() => json({ ok: true }));

      routes
        .accept("GET", "/items")
        .input({ query: z.object({ q: z.string().optional() }) })
        .handler((ctx) => json({ q: ctx.query.q ?? null }));

      routes
        .accept("GET", "/items/:id")
        .input({ params: z.object({ id: z.coerce.number() }) })
        .handler((ctx) => json({ id: ctx.params.id }));

      routes
        .accept("POST", "/items")
        .input({ body: z.object({ title: z.string().min(1) }) })
        .handler((ctx) => status(201).json({ title: ctx.body.title }));

      app.use(routes);
      // #endsection

      const response = await serve(app)({
        method: "GET",
        path: "/items/42",
        query: { q: "ada" },
        headers: {},
        cookies: {},
        params: {},
        body: undefined,
      });
      expect(response).toEqual({ status: 200, body: { id: 42 } });
    });
  });
});

describe("per-endpoint input", () => {
  it("inherits the router's input as the base per bucket", async () => {
    const app = http.app("inherit-base");
    const routes = http.router().input({
      headers: z.object({ "x-token": z.string() }),
    });

    routes
      .accept("GET", "/ping")
      .input({ query: z.object({ echo: z.string().optional() }) })
      .handler((ctx) =>
        json({ token: ctx.headers["x-token"], echo: ctx.query.echo ?? null }),
      );
    app.use(routes);

    const ok = await serve(app)(
      makeRequest({
        path: "/ping",
        query: { echo: "a" },
        headers: { "x-token": "secret" },
      }),
    );
    expect(ok).toEqual({
      status: 200,
      body: { token: "secret", echo: "a" },
    });

    const rejected = await serve(app)(
      makeRequest({ path: "/ping", headers: {} }),
    );
    expect(rejected.status).toBe(400);
  });

  it("overrides a router bucket per endpoint while others inherit", async () => {
    const app = http.app("override");
    const routes = http.router().input({
      params: z.object({ id: z.coerce.number() }),
    });

    routes
      .accept("GET", "/orders/:code")
      .input({ params: z.object({ code: z.string().min(1) }) })
      .handler((ctx) => json({ code: ctx.params.code }));

    routes
      .accept("GET", "/numbers/:id")
      .handler((ctx) => json({ id: ctx.params.id }));
    app.use(routes);

    const overridden = await serve(app)(makeRequest({ path: "/orders/AB-1" }));
    expect(overridden).toEqual({ status: 200, body: { code: "AB-1" } });

    const base = await serve(app)(makeRequest({ path: "/numbers/42" }));
    expect(base).toEqual({ status: 200, body: { id: 42 } });

    const rejected = await serve(app)(
      makeRequest({ path: "/numbers/not-a-number" }),
    );
    expect(rejected.status).toBe(400);
  });

  it("validates each endpoint against its own input", async () => {
    const app = http.app("per-endpoint-validation");
    const routes = http.router();

    routes
      .accept("POST", "/items")
      .input({ body: z.object({ title: z.string().min(1) }) })
      .handler((ctx) => status(201).json({ title: ctx.body.title }));

    routes
      .accept("POST", "/notes")
      .input({ body: z.object({ text: z.string() }) })
      .handler((ctx) => status(201).json({ text: ctx.body.text }));

    app.use(routes);

    const valid = await serve(app)(
      makeRequest({ method: "POST", path: "/items", body: { title: "Hello" } }),
    );
    expect(valid.status).toBe(201);
    expect(valid.body).toEqual({ title: "Hello" });

    const invalid = await serve(app)(
      makeRequest({ method: "POST", path: "/items", body: { title: "" } }),
    );
    expect(invalid.status).toBe(400);

    const ownRoute = await serve(app)(
      makeRequest({ method: "POST", path: "/notes", body: { text: "Hi" } }),
    );
    expect(ownRoute.status).toBe(201);
  });

  it("collects endpoint input alongside the router base", () => {
    const app = http.app("routes-collect");
    const routes = http.router().input({
      headers: z.object({ authorization: z.string() }),
    });
    routes
      .accept("GET", "/authors/:id")
      .input({ params: z.object({ id: z.coerce.number() }) })
      .handler(() => json({}));
    app.use(routes);

    const collected = routesOf(app);
    expect(collected[0]?.req).toBeDefined();
    expect(collected[0]?.endpoints[0]?.req).toBeDefined();
    expect(collected[0]?.endpoints[0]?.pathParams).toEqual(["id"]);
  });
});
