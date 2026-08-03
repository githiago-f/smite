import { describe, expect, it } from "vitest";
import { configure, request } from "./runtime.js";

describe("client runtime documentation examples", () => {
  it("configures the client runtime", async () => {
    // #section - Configure the client runtime
    configure({
      baseUrl: "https://api.example.com",
      fetch: async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
    });
    const response = await request("GET", "/health");
    // #endsection

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("makes a typed request", async () => {
    // #section - Make a typed request
    configure({
      baseUrl: "https://api.example.com",
      fetch: async () =>
        new Response(JSON.stringify({ id: "42" }), { status: 200 }),
    });
    const response = await request("GET", "/users/:id", {
      params: { id: "42" },
      query: { verbose: "1" },
    });
    // #endsection

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "42" });
  });
});
