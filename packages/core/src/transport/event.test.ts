import { describe, expect, it } from "vitest";
import { http, event, handleify, messaging, scheduler } from "../index.js";
import type { PipelineContext } from "../index.js";

describe("event.request", () => {
  it("defaults to a GET request on /", () => {
    expect(event.request().build()).toEqual({
      method: "GET",
      path: "/",
      headers: {},
      cookies: {},
      query: {},
      params: {},
      body: undefined,
      raw: undefined,
    });
  });

  it("builds a request with optional fields", () => {
    const built = event
      .request()
      .method("POST")
      .path("/users")
      .headers({ "content-type": "application/json" })
      .cookies({ session: "abc" })
      .query({ page: "2" })
      .params({ id: "42" })
      .body({ name: "Ada" })
      .raw({ platform: "node" })
      .build();

    expect(built).toEqual({
      method: "POST",
      path: "/users",
      headers: { "content-type": "application/json" },
      cookies: { session: "abc" },
      query: { page: "2" },
      params: { id: "42" },
      body: { name: "Ada" },
      raw: { platform: "node" },
    });
    expect(Object.isFrozen(built)).toBe(true);
  });

  it("builds immutably", () => {
    const base = event.request();
    const derived = base.path("/users");

    expect(base.build().path).toBe("/");
    expect(derived.build().path).toBe("/users");
  });

  it("feeds a handleified controller", async () => {
    const serve = handleify(
      http.controller().routes(
        http.route.post("/users", () => ({
          status: 201,
          body: { ok: true },
        })),
      ),
    );

    // #section - Build a request
    const req = event
      .request()
      .method("POST")
      .path("/users")
      .body({ name: "Ada" })
      .build();

    const result = await serve(req);
    // #endsection

    expect(result).toEqual({ status: 201, body: { ok: true } });
  });
});

describe("event.message", () => {
  it("builds a message with optional fields", () => {
    expect(
      event
        .message()
        .id("evt-1")
        .attributes({ "x-trace": "abc" })
        .body({ amount: 100 })
        .build(),
    ).toEqual({
      id: "evt-1",
      attributes: { "x-trace": "abc" },
      body: { amount: 100 },
    });
  });

  it("builds an empty message", () => {
    expect(event.message().build()).toEqual({});
  });

  it("feeds a handleified consumer", async () => {
    const consume = handleify(
      messaging.consumer().handler((context: PipelineContext) => context.input),
    );

    // #section - Build a message
    const msg = event.message().id("evt-1").body({ amount: 100 }).build();

    const result = await consume(msg);
    // #endsection

    expect(result).toEqual({ id: "evt-1", body: { amount: 100 } });
  });
});

describe("event.cron", () => {
  it("builds a cron event with a scheduled time", () => {
    const firedAt = new Date("2026-07-31T12:00:00Z");

    expect(event.cron().at(firedAt).build()).toEqual({ scheduledAt: firedAt });
  });

  it("defaults to the current time", () => {
    expect(event.cron().build().scheduledAt).toBeInstanceOf(Date);
  });

  it("feeds a handleified job", async () => {
    const run = handleify(
      scheduler.job().handler((context: PipelineContext) => context.input),
    );

    // #section - Build a cron event
    const firedAt = new Date("2026-07-31T12:00:00Z");
    const evt = event.cron().at(firedAt).build();

    const result = await run(evt);
    // #endsection

    expect(result).toEqual({ scheduledAt: firedAt });
  });

  it("runs a job without an event", async () => {
    const run = handleify(scheduler.job().handler(() => "done"));

    expect(await run()).toBe("done");
  });
});
