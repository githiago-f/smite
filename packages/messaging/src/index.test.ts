import { childrenOf, clear, createApp } from "@smitejs/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { broker, channel, channelsOf, messaging } from "./index.js";

afterEach(() => clear());

describe("channel builders", () => {
  it("defines a channel and attaches consumers", () => {
    const app = createApp();

    // #section - Define a channel
    const orders = channel(app, "orders")
      .kind("topic")
      .schema(z.object({ orderId: z.string() }))
      .on(() => undefined);
    // #endsection

    expect(orders.node.__kind).toBe("messaging.channel");
    expect(orders.node.data.name).toBe("orders");
    expect(orders.node.data.kind).toBe("topic");
    expect(childrenOf(app, "messaging.channel").length).toBe(1);
    expect(childrenOf(orders.node, "messaging.consumer").length).toBe(1);
  });

  it("registers a queue channel with a single consumer", () => {
    const app = createApp();
    channel(app, "inbox")
      .kind("queue")
      .on(() => undefined);
    const [collected] = channelsOf(app);
    expect(collected?.kind).toBe("queue");
    expect(collected?.consumers.length).toBe(1);
  });

  it("collects an app's channels", () => {
    const app = createApp();

    // #section - Collect an app's channels
    channel(app, "a").on(() => undefined);
    channel(app, "b")
      .kind("queue")
      .on(() => undefined);
    const collected = channelsOf(app);
    // #endsection

    expect(collected.map((entry) => entry.name).sort()).toEqual(["a", "b"]);
  });
});

describe("broker executor", () => {
  it("publishes to a topic and fans out to every consumer", async () => {
    const app = createApp();
    const seen: string[] = [];
    channel(app, "events")
      .kind("topic")
      .on(({ payload }) => {
        seen.push(`first:${String((payload as { kind: string }).kind)}`);
      })
      .on(({ payload }) => {
        seen.push(`second:${String((payload as { kind: string }).kind)}`);
      });

    // #section - Publish a message to a channel
    const bus = broker(app);
    const delivered = await bus.publish("events", { kind: "order.placed" });
    // #endsection

    expect(delivered).toBe(2);
    expect(seen).toEqual(["first:order.placed", "second:order.placed"]);
  });

  it("routes a queue to the most recent consumer", async () => {
    const app = createApp();
    const seen: string[] = [];
    channel(app, "inbox")
      .kind("queue")
      .on(() => {
        seen.push("first");
      })
      .on(() => {
        seen.push("second");
      });

    const bus = broker(app);
    await bus.publish("inbox", "hello");
    expect(seen).toEqual(["second"]);
  });

  it("validates a payload against the channel schema", async () => {
    const app = createApp();
    channel(app, "validated")
      .schema(z.object({ value: z.number() }))
      .on(() => undefined);

    const bus = broker(app);
    expect(await bus.publish("validated", { value: 2 })).toBe(1);
    await expect(
      bus.publish("validated", { value: "no" }),
    ).rejects.toBeTruthy();
  });

  it("returns 0 for an unknown channel", async () => {
    const app = createApp();
    const bus = broker(app);
    expect(await bus.publish("missing", null)).toBe(0);
    expect(bus.lookup("missing")).toBeUndefined();
  });

  it("registers a messaging namespace bundle", () => {
    // #section - Declare a messaging bundle
    const bundle = messaging;
    // #endsection

    expect(typeof bundle.broker).toBe("function");
    expect(typeof bundle.channel).toBe("function");
    expect(typeof bundle.channelsOf).toBe("function");
  });
});
