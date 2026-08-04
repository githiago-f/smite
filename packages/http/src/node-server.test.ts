import type { AddressInfo } from "node:net";
import { clear } from "@smite/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { http, json, serveNode, status } from "./index.js";

afterEach(() => clear());

const listenOn = async (server: {
  listen: (port: number, host: string, cb?: () => void) => unknown;
}) => {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
};

const close = (server: { close: (cb?: () => void) => unknown }) =>
  new Promise<void>((resolve) => server.close(() => resolve()));

describe("serveNode", () => {
  it("serves routes over node:http", async () => {
    // #section - Serve an app over node:http
    const app = http.app("store");
    const route = http.route(app);
    route.accept("GET", "/health").handler(() => json({ ok: true }));
    const server = serveNode(app);
    // #endsection

    const base = await listenOn(server);
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    await close(server);
  });

  it("parses query, cookies, and a JSON body", async () => {
    const app = http.app("form");
    const route = http.route(app).req({
      body: z.object({ name: z.string() }),
    });
    route.accept("POST", "/items").handler((ctx) =>
      status(201).json({
        name: ctx.body.name,
        cookie: ctx.request.cookies.session,
      }),
    );

    const server = serveNode(app);
    const base = await listenOn(server);

    const response = await fetch(`${base}/items?q=1`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "session=abc123",
      },
      body: JSON.stringify({ name: "Alice" }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ name: "Alice", cookie: "abc123" });
    await close(server);
  });

  it("mounts a docs router ahead of the app routes", async () => {
    const app = http.app("api");
    const route = http.route(app);
    route.accept("GET", "/ping").handler(() => json({ pong: true }));

    const docs = {
      router: async (request: { path: string }) =>
        request.path === "/docs"
          ? { status: 200, body: "docs" }
          : { status: 404, body: {} },
      paths: ["/docs"],
    };

    const server = serveNode(app, { docs });
    const base = await listenOn(server);

    const docsResponse = await fetch(`${base}/docs`);
    expect(docsResponse.status).toBe(200);
    expect(await docsResponse.text()).toBe("docs");

    const appResponse = await fetch(`${base}/ping`);
    expect(appResponse.status).toBe(200);
    expect(await appResponse.json()).toEqual({ pong: true });
    await close(server);
  });

  it("lets transformRequest override the parsed request", async () => {
    const app = http.app("virtual");
    const route = http.route(app);
    route.accept("GET", "/virtual").handler(() => json({ ok: true }));

    const server = serveNode(app, {
      transformRequest: () => ({ path: "/virtual" }),
    });
    const base = await listenOn(server);

    const response = await fetch(`${base}/anything`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    await close(server);
  });
});
