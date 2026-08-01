import { http, lifecycle } from "@smite/core";
import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { createExpressRuntime } from "./runtime.js";
import type {
  ExpressRequestLike,
  ExpressResponseLike,
  ExpressRouter,
  SmiteHttpContext,
} from "./types.js";

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

    const response = await dispatch(
      createExpressRuntime({ controllers: [controller] }),
      {
        method: "POST",
        url: "/users",
        headers: { "x-api-key": "local-dev" },
        body: { name: "Lin" },
      },
    );
    // #endsection

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ name: "Lin", parsed: true });
  });

  it("parses the cookie header into the internal request context", async () => {
    // #section - Express cookie adaptation
    const controller = http
      .controller()
      .path("/")
      .routes(
        http.route.get("/", (context: SmiteHttpContext) => ({
          body: context.request.cookies,
        })),
      );

    const response = await dispatch(
      createExpressRuntime({ controllers: [controller] }),
      {
        method: "GET",
        url: "/",
        headers: { cookie: "session_id=abc123; theme=dark" },
      },
    );
    // #endsection

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ session_id: "abc123", theme: "dark" });
  });

  it("short-circuits denied guards before executing the handler", async () => {
    let executed = false;
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

    const response = await dispatch(
      createExpressRuntime({ controllers: [controller] }),
      { method: "GET", url: "/users" },
    );

    expect(executed).toBe(false);
    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: "Forbidden" });
  });

  it("binds express route params into the internal request params", async () => {
    const controller = http
      .controller()
      .path("/users")
      .routes(
        http.route.get("/:profileId", (context: SmiteHttpContext) => ({
          body: context.request.params,
        })),
      );

    const response = await dispatch(
      createExpressRuntime({ controllers: [controller] }),
      { method: "GET", url: "/users/42" },
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ profileId: "42" });
  });

  it("mounts multiple controllers at their own paths", async () => {
    const users = http
      .controller()
      .path("/users")
      .routes(http.route.get("/", () => ({ body: { users: true } })));
    const posts = http
      .controller()
      .path("/posts")
      .routes(http.route.get("/", () => ({ body: { posts: true } })));

    const runtime = createExpressRuntime({ controllers: [users, posts] });

    const usersResponse = await dispatch(runtime, {
      method: "GET",
      url: "/users",
    });
    const postsResponse = await dispatch(runtime, {
      method: "GET",
      url: "/posts",
    });

    expect(usersResponse.body).toEqual({ users: true });
    expect(postsResponse.body).toEqual({ posts: true });
  });

  it("falls through to the next middleware when no route matches", async () => {
    const controller = http
      .controller()
      .path("/users")
      .routes(http.route.get("/", () => ({ body: { users: true } })));

    let nextCalled = false;
    const response = createResponse();

    createExpressRuntime({ controllers: [controller] })(
      { method: "GET", url: "/missing" } as Request,
      response as unknown as Response,
      (error) => {
        if (error) {
          throw error;
        }
        nextCalled = true;
        response.settle();
      },
    );
    await response.settled;

    expect(nextCalled).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(response.headersSent).toBe(false);
  });
});

const dispatch = async (
  router: ExpressRouter,
  request: ExpressRequestLike,
): Promise<ExpressResponseLike & { body?: unknown }> => {
  const response = createResponse();
  let reject: (error: unknown) => void = () => {};
  const failed = new Promise<never>((_, rej) => {
    reject = rej;
  });

  router(request as Request, response as unknown as Response, (error) => {
    if (error) {
      reject(error);
      return;
    }
    response.settle();
  });

  await Promise.race([response.settled, failed]);

  return response;
};

const createResponse = (): ExpressResponseLike & {
  body?: unknown;
  settled: Promise<void>;
  settle: () => void;
} => {
  let resolveSettled: () => void = () => {};
  const settled = new Promise<void>((resolve) => {
    resolveSettled = resolve;
  });

  const response: ExpressResponseLike & {
    body?: unknown;
    settled: Promise<void>;
    settle: () => void;
  } = {
    statusCode: 200,
    headersSent: false,
    setHeader: () => {},
    status: (status) => {
      response.statusCode = status;
      return response;
    },
    json: (body) => {
      response.headersSent = true;
      response.body = body;
      resolveSettled();
    },
    end: () => {
      response.headersSent = true;
      resolveSettled();
    },
    settled,
    settle: () => resolveSettled(),
  };

  return response;
};
