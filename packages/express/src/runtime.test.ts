import { createApplication, http, lifecycle } from "@smite/core";
import { Result } from "@smite/fp";
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

    const runtime = createExpressRuntime({ application: createApplication().add(controller) });
    const response = createResponse();

    await runtime(
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

    const runtime = createExpressRuntime({ application: createApplication().add(controller) });
    const response = createResponse();

    await runtime({ method: "GET", url: "/users" }, response, (error) => {
      throw error;
    });

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

  it("converts Result.err with status tag to HTTP response", async () => {
    // #section - Result err to HTTP
    const controller = http
      .controller()
      .path("/users")
      .routes(
        http.route.get("/42", () =>
          Result.err(404, { message: "User not found" }),
        ),
      );

    const runtime = createExpressRuntime({ application: createApplication().add(controller) });
    const response = createResponse();

    await runtime(
      { method: "GET", url: "/users/42" },
      response,
      (error) => {
        throw error;
      },
    );

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ message: "User not found" });
    // #endsection
  });

  it("converts Result.ok to 200 response", async () => {
    // #section - Result ok to HTTP
    const controller = http
      .controller()
      .path("/users")
      .routes(
        http.route.get("/42", () =>
          Result.ok({ id: "42", name: "Ada" }),
        ),
      );

    const runtime = createExpressRuntime({ application: createApplication().add(controller) });
    const response = createResponse();

    await runtime(
      { method: "GET", url: "/users/42" },
      response,
      (error) => {
        throw error;
      },
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ id: "42", name: "Ada" });
    // #endsection
  });

  it("applies lifecycle to individual routes", async () => {
    // #section - Route-specific lifecycle
    const apiKeyGuard = lifecycle.guard(
      "api-key",
      (context: SmiteHttpContext) =>
        context.request.headers["x-api-key"] === "admin",
    );

    const controller = http
      .controller()
      .path("/admin")
      .routes(
        http.route
          .delete("/users", () => ({ status: 204 }))
          .use(apiKeyGuard),
        http.route.get("/health", () => ({ body: "ok" })),
      );

    const runtime = createExpressRuntime({ application: createApplication().add(controller) });
    const denied = createResponse();
    const passed = createResponse();

    await runtime(
      { method: "DELETE", url: "/admin/users", headers: {} },
      denied,
      (error) => {
        throw error;
      },
    );
    await runtime(
      { method: "GET", url: "/admin/health" },
      passed,
      (error) => {
        throw error;
      },
    );

    expect(denied.statusCode).toBe(403);
    expect(passed.statusCode).toBe(200);
    // #endsection
  });

  it("reuses lifecycle compositions across controllers", async () => {
    // #section - Reusable lifecycle composition
    const authenticated = lifecycle.create().guards(
      lifecycle.guard("auth", (context: SmiteHttpContext) =>
        Boolean(context.request.headers.authorization),
      ),
    );

    const UsersController = http
      .controller()
      .use(authenticated)
      .path("/users")
      .routes(http.route.get("/", () => ({ body: "users" })));

    const BillingController = http
      .controller()
      .use(authenticated)
      .path("/billing")
      .routes(http.route.get("/", () => ({ body: "billing" })));

    const runtime = createExpressRuntime({
      application: createApplication().add(UsersController, BillingController),
    });
    const denied = createResponse();
    const passed = createResponse();

    await runtime({ method: "GET", url: "/users" }, denied, (error) => {
      throw error;
    });
    expect(denied.statusCode).toBe(403);

    await runtime(
      { method: "GET", url: "/billing", headers: { authorization: "tok" } },
      passed,
      (error) => {
        throw error;
      },
    );
    expect(passed.statusCode).toBe(200);
    // #endsection
  });

  it("attaches input schemas to routes", async () => {
    // #section - Route input schema
    const BodySchema = {
      parse: (input: unknown) => input as { readonly name: string },
    };

    const controller = http
      .controller()
      .path("/users")
      .routes(
        http.route
          .post("/", (context: SmiteHttpContext) => ({
            body: context.request.body,
          }))
          .input({ body: BodySchema }),
      );

    const runtime = createExpressRuntime({ application: createApplication().add(controller) });
    const response = createResponse();

    await runtime(
      { method: "POST", url: "/users", body: { name: "Ada" } },
      response,
      (error) => {
        throw error;
      },
    );

    expect(response.statusCode).toBe(200);
    // #endsection
  });

  it("returns http result objects from handlers", async () => {
    // #section - HttpResult from handler
    const controller = http
      .controller()
      .path("/items")
      .routes(
        http.route.get("/missing", () =>
          http.result(http.NOT_FOUND, { message: "missing" }),
        ),
      );

    const runtime = createExpressRuntime({ application: createApplication().add(controller) });
    const response = createResponse();

    await runtime(
      { method: "GET", url: "/items/missing" },
      response,
      (error) => {
        throw error;
      },
    );

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ message: "missing" });
    // #endsection
  });

  it("produces new builders without mutating previous ones", async () => {
    // #section - Immutable builder derivation
    const jwtGuard = lifecycle.guard("jwt");

    const base = http.controller().use(jwtGuard);
    const UsersController = base.path("/users");
    const BillingController = base.path("/billing");

    expect(base.descriptor.path).toBe("");
    expect(UsersController.descriptor.path).toBe("/users");
    expect(BillingController.descriptor.path).toBe("/billing");
    // #endsection
  });

  it("attaches output schemas to routes", async () => {
    // #section - Route output schema
    const UserSchema = {
      parse: (input: unknown) => input as { readonly id: string },
    };

    const controller = http
      .controller()
      .path("/users")
      .routes(
        http.route
          .get("/:id", () => undefined)
          .output({ [http.OK]: UserSchema, [http.NOT_FOUND]: UserSchema }),
      );

    expect(controller.descriptor.routes[0]?.output?.[http.OK]).toBe(UserSchema);
    // #endsection
  });

  it("composes reusable specs with extend", async () => {
    // #section - Route spec extend
    const ParamsSchema = {
      parse: (input: unknown) => input as { readonly id: string },
    };

    const base = http.route.input({ params: ParamsSchema });

    const controller = http
      .controller()
      .path("/users")
      .routes(
        http.route.extend(base).get("/profile", () => ({ body: "user" })),
        http.route.extend(base).delete("/profile", () => ({ status: 204 })),
      );

    const runtime = createExpressRuntime({ application: createApplication().add(controller) });
    const response = createResponse();

    await runtime(
      { method: "GET", url: "/users/profile" },
      response,
      (error) => {
        throw error;
      },
    );
    expect(response.statusCode).toBe(200);
    // #endsection
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
