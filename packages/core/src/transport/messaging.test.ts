import { describe, expect, it } from "vitest";
import { lifecycle, messaging } from "../index.js";

describe("messaging", () => {
  it("builds immutable consumer descriptors with lifecycle composition", () => {
    // #section - Messaging consumer with lifecycle
    const JwtGuard = lifecycle.guard("jwt");
    const authenticated = lifecycle.create().guards(JwtGuard);
    const processBilling = () => undefined;

    const BillingConsumer = messaging
      .consumer()
      .use(authenticated)
      .queue("billing-events")
      .handler(processBilling);
    // #endsection

    expect(BillingConsumer.descriptor).toMatchObject({
      kind: "messaging.consumer",
      queue: "billing-events",
      handler: processBilling,
    });
    expect(BillingConsumer.descriptor.lifecycle.entries).toEqual(
      authenticated.descriptor.entries,
    );
    expect(Object.isFrozen(BillingConsumer.descriptor.lifecycle.entries)).toBe(
      true,
    );
  });

  it("keeps earlier consumer builders immutable", () => {
    const base = messaging.consumer();
    const billing = base.queue("billing-events");

    expect(base.descriptor.queue).toBe("");
    expect(billing.descriptor.queue).toBe("billing-events");
    expect(base.descriptor.handler).toBeUndefined();
    expect(billing.descriptor.handler).toBeUndefined();
  });
});
