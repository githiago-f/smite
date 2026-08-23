import { childrenOf, clear, createApp } from "@smitejs/core";
import { afterEach, describe, expect, it } from "vitest";
import { hub, realtime, socket, socketsOf } from "./index.js";

afterEach(() => clear());

describe("socket builders", () => {
  it("defines a socket with lifecycle and message events", () => {
    const app = createApp();

    // #section - Define a socket
    const chat = socket(app, "chat")
      .onConnect(() => undefined)
      .onMessage(({ payload }) => void payload)
      .onDisconnect(() => undefined);
    // #endsection

    expect(chat.node.__kind).toBe("realtime.socket");
    expect(chat.node.data.name).toBe("chat");
    const events = childrenOf(chat.node, "realtime.event");
    expect(
      events.map((node) => (node as { data: { event: string } }).data.event),
    ).toEqual(["connect", "message", "disconnect"]);
    expect(childrenOf(app, "realtime.socket").length).toBe(1);
  });

  it("collects an app's sockets", () => {
    const app = createApp();

    // #section - Collect an app's sockets
    socket(app, "presence").onConnect(() => undefined);
    socket(app, "chat").onMessage(() => undefined);
    const collected = socketsOf(app);
    // #endsection

    expect(collected.map((entry) => entry.name).sort()).toEqual([
      "chat",
      "presence",
    ]);
    expect(collected.find((entry) => entry.name === "chat")?.events).toEqual([
      "message",
    ]);
  });

  it("registers a realtime namespace bundle", () => {
    // #section - Declare a realtime bundle
    const bundle = realtime;
    // #endsection

    expect(typeof bundle.hub).toBe("function");
    expect(typeof bundle.socket).toBe("function");
    expect(typeof bundle.socketsOf).toBe("function");
  });
});

describe("hub executor", () => {
  it("drives connect, message, and disconnect events", async () => {
    const app = createApp();
    const log: string[] = [];
    socket(app, "room")
      .onConnect(() => {
        log.push("connect");
      })
      .onMessage(({ payload }) => {
        log.push(`msg:${String((payload as { text: string }).text)}`);
      })
      .onDisconnect(() => {
        log.push("disconnect");
      });

    // #section - Drive a socket's events
    const chat = hub(app);
    await chat.connect("room", "conn-1");
    await chat.emit("room", { text: "hi" });
    await chat.disconnect("room", "conn-1");
    // #endsection

    expect(log).toEqual(["connect", "msg:hi", "disconnect"]);
  });

  it("ignores unknown sockets and missing events", async () => {
    const app = createApp();
    socket(app, "room").onMessage(() => undefined);

    const bus = hub(app, { onError: () => undefined });

    await expect(bus.connect("room", "c")).resolves.toBe("c");
    await expect(bus.emit("missing", {})).resolves.toBe(0);
    await expect(bus.disconnect("room", "c")).resolves.toBe(0);
    expect(bus.sockets.map((entry) => entry.name)).toEqual(["room"]);
  });
});
