import { clear, currentScope } from "@smitejs/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  http,
  HttpMethod,
  aspect,
  currentLogger,
  json,
  requestLogger,
  status,
} from "./index.js";
import type { HttpRequest } from "./types.js";

afterEach(() => clear());

const makeRequest = (overrides: Partial<HttpRequest> = {}): HttpRequest => ({
  method: "GET",
  path: "/",
  query: {},
  headers: {},
  cookies: {},
  params: {},
  body: undefined,
  ...overrides,
});

describe("middleware", () => {
  it("runs middleware before the handler and can short-circuit", async () => {
    const app = http
      .app()
      .use(
        aspect.middleware((_ctx, _next) => ({ status: 200, body: "short" })),
      );

    const route = http.router();
    route
      .accept(HttpMethod.GET, "/")
      .handler((_ctx) => ({ status: 200, body: "never" }));
    app.use(route);

    const response = await app.serve()(makeRequest({ path: "/" }));
    expect(response).toEqual({ status: 200, body: "short" });
  });

  it("exposes the request scope to the handler", async () => {
    const app = http.app().use(
      aspect.middleware(async (ctx, next) => {
        ctx.scope.marker = "set-by-middleware";
        return next();
      }),
    );

    let observed: unknown;
    const route = http.router();
    route.accept(HttpMethod.GET, "/").handler((_ctx) => {
      observed = currentScope()?.marker;
      return json({ ok: true });
    });
    app.use(route);

    await app.serve()(makeRequest({ path: "/" }));
    expect(observed).toBe("set-by-middleware");
  });

  it("provides a request-scoped logger via currentLogger", async () => {
    const app = http.app().use(requestLogger({ level: "silent" }));

    let bindings: Record<string, unknown> | undefined;
    const route = http.router();
    route.accept(HttpMethod.GET, "/health").handler((_ctx) => {
      bindings = currentLogger()?.bindings();
      return json({ ok: true });
    });
    app.use(route);

    const response = await app.serve()(
      makeRequest({ method: "GET", path: "/health" }),
    );
    expect(response).toEqual({ status: 200, body: { ok: true } });
    expect(bindings?.request).toMatchObject({ method: "GET", path: "/health" });
  });
});

describe("guards", () => {
  it("short-circuits the pipeline when a guard returns a response", async () => {
    const app = http
      .app()
      .use(
        aspect.guard((ctx) =>
          ctx.request.headers["x-api-key"]
            ? undefined
            : status(401).json({ error: "missing api key" }),
        ),
      );

    const route = http.router();
    route.accept(HttpMethod.GET, "/admin").handler(() => json({ admin: true }));
    app.use(route);

    const serve = app.serve();
    const denied = await serve(makeRequest({ path: "/admin" }));
    expect(denied).toEqual({
      status: 401,
      body: { error: "missing api key" },
    });

    const allowed = await serve(
      makeRequest({ path: "/admin", headers: { "x-api-key": "secret" } }),
    );
    expect(allowed).toEqual({ status: 200, body: { admin: true } });
  });
});

describe("filters", () => {
  it("post-processes the handler's response", async () => {
    const app = http.app().use(
      aspect.filter((response, ctx) =>
        status(response.status)
          .header("x-request-id", ctx.request.headers["x-request-id"] ?? "none")
          .json(response.body),
      ),
    );

    const route = http.router();
    route.accept(HttpMethod.GET, "/").handler(() => json({ ok: true }));
    app.use(route);

    const response = await app.serve()(
      makeRequest({ path: "/", headers: { "x-request-id": "req-1" } }),
    );
    expect(response).toEqual({
      status: 200,
      body: { ok: true },
      headers: { "x-request-id": "req-1" },
    });
  });
});

describe("interceptors", () => {
  it("wraps the pipeline and can observe the response", async () => {
    const app = http.app().use(
      aspect.interceptor(async (_ctx, next) => {
        const response = await next();
        return status(response.status)
          .header("x-took-ms", "1")
          .json(response.body);
      }),
    );

    const route = http.router();
    route.accept(HttpMethod.GET, "/").handler(() => json({ ok: true }));
    app.use(route);

    const response = await app.serve()(makeRequest({ path: "/" }));
    expect(response).toEqual({
      status: 200,
      body: { ok: true },
      headers: { "x-took-ms": "1" },
    });
  });
});

describe("documentation examples", () => {
  it("log every request", async () => {
    // #section - Log every request
    const app = http.app().use(requestLogger({ level: "error" }));

    const routes = http.router();
    routes
      .accept(HttpMethod.GET, "/health")
      .handler((_ctx) => json({ ok: true }));
    app.use(routes);

    const router = app.serve();
    // #endsection

    const response = await router(
      makeRequest({ method: "GET", path: "/health" }),
    );
    expect(response).toEqual({ status: 200, body: { ok: true } });
  });

  it("apply AOP aspects", async () => {
    // #section - Apply AOP aspects
    const app = http.app("secure");

    app.use(
      aspect.middleware(async (ctx, next) => {
        ctx.scope.clock = { started: Date.now() };
        return next();
      }),
    );

    app.use(
      aspect.guard((ctx) =>
        ctx.request.headers.authorization
          ? undefined
          : status(401).json({ error: "unauthorized" }),
      ),
    );

    app.use(
      aspect.interceptor(async (_ctx, next) => {
        const response = await next();
        return status(response.status)
          .header("x-powered-by", "smite")
          .json(response.body);
      }),
    );

    app.use(
      aspect.filter((response) =>
        status(response.status).json({
          ...(response.body as Record<string, unknown>),
          served: true,
        }),
      ),
    );

    const routes = http.router();
    routes.accept(HttpMethod.GET, "/me").handler(() => json({ user: "self" }));
    app.use(routes);
    // #endsection

    const router = app.serve();
    const granted = await router(
      makeRequest({
        path: "/me",
        headers: { authorization: "Bearer tok" },
      }),
    );
    expect(granted).toEqual({
      status: 200,
      body: { user: "self", served: true },
      headers: { "x-powered-by": "smite" },
    });

    const denied = await router(makeRequest({ path: "/me" }));
    expect(denied).toEqual({
      status: 401,
      body: { error: "unauthorized" },
      headers: { "x-powered-by": "smite" },
    });
  });
});
