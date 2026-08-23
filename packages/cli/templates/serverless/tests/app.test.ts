import { describe, expect, it } from "vitest";
import { handler } from "../src/handler.js";

describe("{{Title}}", () => {
  it("answers an API Gateway v2 event over GET /items/:id", async () => {
    const response = await handler({
      version: "2.0",
      rawPath: "/items/42",
      rawQueryString: "q=ada",
      requestContext: { http: { method: "GET", path: "/items/42" } },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ id: 42 });
  });

  it("creates an item from a JSON body on POST /items", async () => {
    const response = await handler({
      version: "2.0",
      rawPath: "/items",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Hello" }),
      requestContext: { http: { method: "POST", path: "/items" } },
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual({ title: "Hello" });
  });
});
