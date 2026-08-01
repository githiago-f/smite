import { describe, expect, it } from "vitest";
import {
  http,
  executePipeline,
  handleify,
  lifecycle,
  messaging,
  scheduler,
} from "../index.js";
import type {
  HttpExecutionContext,
  HttpExecutionRequest,
  PipelineContext,
} from "../index.js";

const request = (path: string): HttpExecutionRequest => ({
  method: "GET",
  path,
  headers: {},
  cookies: {},
  query: {},
  params: {},
  body: undefined,
  raw: undefined,
});

describe("handleify scheduler", () => {
  it("runs middlewares and dispatches a job handler", async () => {
    const Seed = lifecycle.provider("seed", () => "seeded");
    const RefreshCache = scheduler
      .job()
      .use(lifecycle.create().providers(Seed))
      .cron("0 0 * * *")
      .handler((context: PipelineContext) => ({
        refreshed: true,
        seed: context.state.seed,
      }));

    // #section - Handleify a scheduler job
    const run = handleify(RefreshCache);
    const result = await run();
    // #endsection

    expect(result).toEqual({ refreshed: true, seed: "seeded" });
  });

  it("skips the handler when a guard denies", async () => {
    const Blocked = scheduler
      .job()
      .use(lifecycle.create().guards(lifecycle.guard("deny", () => false)))
      .cron("0 0 * * *")
      .handler(() => "ran");

    expect(await handleify(Blocked)()).toBe(undefined);
  });

  it("accepts a raw descriptor", async () => {
    const job = scheduler
      .job()
      .cron("0 0 * * *")
      .handler(() => "ok");
    expect(await handleify(job.descriptor)()).toBe("ok");
  });
});

describe("handleify messaging", () => {
  it("runs middlewares and dispatches a consumer handler", async () => {
    const Tenant = lifecycle.provider("tenant", () => "acme");
    const Billing = messaging
      .consumer()
      .use(lifecycle.create().providers(Tenant))
      .queue("billing-events")
      .handler((context: PipelineContext) => ({
        processed: context.input,
        tenant: context.state.tenant,
      }));

    // #section - Handleify a messaging consumer
    const consume = handleify(Billing);
    const result = await consume({ id: "evt-1" });
    // #endsection

    expect(result).toEqual({ processed: { id: "evt-1" }, tenant: "acme" });
  });

  it("transforms the message through pipes", async () => {
    const Enrich = lifecycle.pipe("enrich", (message: unknown) => ({
      ...(message as Record<string, unknown>),
      enriched: true,
    }));
    const Consumer = messaging
      .consumer()
      .use(lifecycle.create().pipes(Enrich))
      .queue("events")
      .handler((context: PipelineContext) => context.input);

    expect(await handleify(Consumer)({ id: "evt-1" })).toEqual({
      id: "evt-1",
      enriched: true,
    });
  });
});

describe("handleify controller", () => {
  it("matches a route, runs middlewares, and dispatches the handler", async () => {
    const Session = lifecycle.provider("session", () => ({ sub: "42" }));
    const Users = http
      .controller()
      .use(lifecycle.create().providers(Session))
      .path("/users")
      .routes(
        http.route.get("/42", (context: HttpExecutionContext) => ({
          status: 200,
          body: { session: context.state.session },
        })),
      );

    // #section - Handleify a controller
    const serve = handleify(Users);
    const ok = await serve(request("/users/42"));
    const missing = await serve(request("/nope"));
    // #endsection

    expect(ok).toEqual({ status: 200, body: { session: { sub: "42" } } });
    expect(missing).toEqual({ status: 404, body: { error: "Not found" } });
  });

  it("denies with 403 when a guard rejects", async () => {
    const Private = http
      .controller()
      .use(lifecycle.create().guards(lifecycle.guard("auth", () => false)))
      .path("/admin")
      .routes(http.route.get("/", () => ({ status: 200, body: "ok" })));

    expect(await handleify(Private)(request("/admin"))).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });
  });

  it("does not treat a handler 404 as a missing route", async () => {
    const Api = http
      .controller()
      .path("/api")
      .routes(
        http.route.get("/v1", () => ({ status: 404, body: { code: "gone" } })),
      );

    const result = await handleify(Api)(request("/api/v1"));
    expect(result).toEqual({ status: 404, body: { code: "gone" } });
  });

  it("binds path parameters from the route pattern", async () => {
    const Users = http
      .controller()
      .path("/users")
      .routes(
        http.route.get("/:profileId", (context: HttpExecutionContext) => ({
          status: 200,
          body: { profileId: context.request.params.profileId },
        })),
      );

    const result = await handleify(Users)(request("/users/42"));
    expect(result).toEqual({ status: 200, body: { profileId: "42" } });
  });

  it("matches routes with multiple parameters", async () => {
    const Posts = http
      .controller()
      .path("/users")
      .routes(
        http.route.get(
          "/:userId/posts/:postId",
          (context: HttpExecutionContext) => ({
            status: 200,
            body: context.request.params,
          }),
        ),
      );

    expect(await handleify(Posts)(request("/users/7/posts/9"))).toEqual({
      status: 200,
      body: { userId: "7", postId: "9" },
    });
  });

  it("distinguishes routes by method", async () => {
    const Users = http
      .controller()
      .path("/users")
      .routes(
        http.route.post("/:id", () => ({ status: 201, body: "created" })),
      );

    const result = await handleify(Users)(request("/users/42"));
    expect(result).toEqual({ status: 404, body: { error: "Not found" } });
  });

  it("tolerates a trailing slash on the request path", async () => {
    const serve = handleify(
      http
        .controller()
        .path("/health")
        .routes(http.route.get("/", () => ({ status: 200, body: "ok" }))),
    );

    expect(await serve(request("/health/"))).toEqual({
      status: 200,
      body: "ok",
    });
  });
});

describe("executePipeline", () => {
  it("executes a generic pipeline over a pipeline context", async () => {
    const Double = lifecycle.pipe(
      "double",
      (input: unknown) => (input as number) * 2,
    );

    // #section - Execute a pipeline
    const outcome = await executePipeline<PipelineContext<number>, number>(
      {
        lifecycle: lifecycle.create().pipes(Double),
        readInput: (context) => context.input,
        withInput: (context, input) => ({
          ...context,
          input: input as number,
        }),
        dispatch: (context) => context.input,
      },
      { input: 21, state: {} },
    );
    // #endsection

    expect(outcome).toEqual({ kind: "value", value: 42 });
  });
});
