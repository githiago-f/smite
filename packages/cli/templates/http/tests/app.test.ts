import { json, serve } from "@smitejs/http";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

const dispatch = (path: string, method = "GET", body?: unknown) =>
  serve(app)({
    method,
    path,
    query: {},
    headers: {},
    cookies: {},
    params: {},
    body,
  });

describe("{{Title}}", () => {
  it("serves GET /health", async () => {
    expect(await dispatch("/health")).toEqual(json({ ok: true }));
  });

  it("coerces path params on GET /items/:id", async () => {
    expect(await dispatch("/items/42")).toEqual({
      status: 200,
      body: { id: 42 },
    });
  });

  it("validates the query on GET /items", async () => {
    expect(await dispatch("/items")).toMatchObject({ status: 200 });
  });

  it("creates an item on POST /items", async () => {
    expect(await dispatch("/items", "POST", { title: "Hello" })).toEqual({
      status: 201,
      body: { title: "Hello" },
    });
  });
});
