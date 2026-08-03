import { clear, lookupAll, relationships } from "@smite/core";
import { Result } from "@smite/fp";
import { http } from "@smite/http";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  command,
  entity,
  handler,
  mergeSpecifications,
  port,
  query,
  specification,
  usecase,
  valueObject,
} from "./index.js";
import type { ReadPort } from "./index.js";

afterEach(() => clear());

describe("value objects", () => {
  it("freezes and compares structurally", () => {
    const Money = valueObject({
      name: "Money",
      schema: z.object({
        amount: z.number().nonnegative(),
        currency: z.string(),
      }),
    });
    const eur = Money.create({ amount: 10, currency: "EUR" }).unwrapOrElse(
      () => null,
    );
    expect(eur).not.toBeNull();
    expect(
      eur.equals(
        Money.create({ amount: 10, currency: "EUR" }).unwrapOrElse(() => null),
      ),
    ).toBe(true);
    expect(
      eur.equals(
        Money.create({ amount: 5, currency: "EUR" }).unwrapOrElse(() => null),
      ),
    ).toBe(false);
  });

  it("is frozen after creation", () => {
    const Box = valueObject({
      name: "Box",
      schema: z.object({ size: z.number() }),
    });
    const box = Box.create({ size: 2 }).unwrapOrElse(() => null);
    expect(Object.isFrozen(box.value)).toBe(true);
  });

  it("returns a validation failure instead of throwing", () => {
    const Money = valueObject({
      name: "Money",
      schema: z.object({
        amount: z.number().nonnegative(),
        currency: z.string(),
      }),
    });
    const result = Money.create({ amount: -1, currency: "EUR" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(
        result.match(
          () => null,
          (e) => e.tag,
        ),
      ).toBe("domain.validation");
    }
  });

  it("registers a domain.valueObject node in collect mode", () => {
    valueObject({ name: "Rating", schema: z.number().int().min(0).max(5) });
    const nodes = lookupAll("domain.valueObject");
    expect(nodes.map((n) => n.__key)).toEqual(["Rating"]);
  });

  it("creates value objects", () => {
    // #section - Create value objects
    const Money = valueObject({
      name: "Money",
      schema: z.object({
        amount: z.number().nonnegative(),
        currency: z.string(),
      }),
    });

    const eur = Money.create({ amount: 10, currency: "EUR" })
      .map((a) =>
        Money.create({ amount: 10, currency: "EUR" })
          .map((b) => a.equals(b))
          .unwrapOr(false),
      )
      .unwrapOr(false);
    // #endsection

    expect(eur).toBe(true);
  });
});

describe("entities", () => {
  it("compares by identity, not by every field", () => {
    const Order = entity({
      name: "Order",
      id: "id",
      schema: z.object({ id: z.number().int().positive(), note: z.string() }),
    });
    const a = Order.create({ id: 7, note: "a" });
    const b = Order.create({ id: 7, note: "b" });
    const different = Order.create({ id: 8, note: "b" });
    expect(
      a.match(
        (e) =>
          e.equals(
            b.match(
              (e2) => e2,
              () => null,
            ),
          ),
        () => false,
      ),
    ).toBe(true);
    expect(
      a.match(
        (e) =>
          e.equals(
            different.match(
              (e2) => e2,
              () => null,
            ),
          ),
        () => false,
      ),
    ).toBe(false);
  });

  it("validates its id", () => {
    const Order = entity({
      name: "Order",
      id: "id",
      schema: z.object({ id: z.number().int().positive(), note: z.string() }),
    });
    expect(Order.create({ id: 0, note: "x" }).isErr()).toBe(true);
  });

  it("registers a domain.entity node in collect mode", () => {
    entity({ name: "Account", id: "id", schema: z.object({ id: z.number() }) });
    expect(lookupAll("domain.entity")[0]).toBeDefined();
  });

  it("treats two entities with the same id as one", () => {
    // #section - Entity identity
    const Order = entity({
      name: "Order",
      id: "id",
      schema: z.object({ id: z.number().int().positive(), note: z.string() }),
    });

    const same = Order.create({ id: 1, note: "first" })
      .map((a) =>
        Order.create({ id: 1, note: "second" })
          .map((b) => a.equals(b))
          .unwrapOr(false),
      )
      .unwrapOr(false);
    // #endsection

    expect(same).toBe(true);
  });
});

describe("ports", () => {
  it("registers a domain.port node", () => {
    port({ name: "OrderRepository", methods: ["findById", "save"] });
    const nodes = lookupAll("domain.port");
    expect(nodes.map((n) => n.__key)).toEqual(["OrderRepository"]);
  });

  it("declares a repository contract", () => {
    // #section - Declare a repository port
    const orderRepo = port({
      name: "OrderRepository",
      methods: ["findById", "save"],
    });
    const loadOrder: ReadPort<{ id: number; total: number }, number> = {
      findById: async () => Promise.resolve(null),
    };
    // #endsection

    expect(loadOrder.findById).toBeDefined();
    expect(orderRepo.__kind).toBe("domain.port");
  });
});

describe("specifications", () => {
  it("short-circuits on the first failing rule, preserving its reason", () => {
    const active = specification({
      name: "active",
      predicate: (value: { readonly active: boolean }) =>
        value.active
          ? Result.ok(true)
          : Result.err("inactive", { message: "not active" }),
    });
    const compound = active.and(
      specification({
        name: "neverRuns",
        predicate: () => {
          throw new Error("should not run");
        },
      }),
    );
    const result = compound.isSatisfiedBy({ active: false });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(
        result.match(
          () => null,
          (e) => e.tag,
        ),
      ).toBe("inactive");
    }
  });

  it("or short-circuits at the first success", () => {
    const lenient = specification({
      name: "lenient",
      predicate: (value) =>
        value === 3 ? Result.ok(true) : Result.err("nope", {}),
    });
    const combined = lenient.or(
      specification({ name: "always", predicate: () => Result.ok(true) }),
    );
    expect(combined.isSatisfiedBy(3).isOk()).toBe(true);
    expect(combined.isSatisfiedBy(4).isOk()).toBe(true);
  });

  it("not inverts satisfaction", () => {
    const active = specification({
      name: "active",
      predicate: (value: { active: boolean }) =>
        value.active ? Result.ok(true) : Result.err("inactive", {}),
    });
    const negated = active.not();
    expect(negated.isSatisfiedBy({ active: false }).isOk()).toBe(true);
    expect(negated.isSatisfiedBy({ active: true }).isOk()).toBe(false);
  });

  it("never mutates the original when composing", () => {
    const base = specification({
      name: "base",
      predicate: () => Result.ok(true),
    });
    const before = base.isSatisfiedBy({}).isOk();
    base.and(
      specification({ name: "other", predicate: () => Result.err("x", {}) }),
    );
    expect(base.isSatisfiedBy({}).isOk()).toBe(before);
  });

  it("mergeSpecifications with zero rules always passes", () => {
    expect(mergeSpecifications().isSatisfiedBy({}).isOk()).toBe(true);
  });

  it("composes specifications", () => {
    // #section - Compose specifications
    const active = specification({
      name: "active",
      predicate: (user: { readonly active: boolean }) =>
        user.active
          ? Result.ok(true)
          : Result.err("inactive", { active: false }),
    });
    const verified = specification({
      name: "verified",
      predicate: (user: { readonly verified: boolean }) =>
        user.verified
          ? Result.ok(true)
          : Result.err("unverified", { verified: false }),
    });
    const allowed = active.and(verified);
    const satisfied = allowed
      .isSatisfiedBy({ active: true, verified: true })
      .isOk();
    // #endsection

    expect(satisfied).toBe(true);
  });
});

describe("usecases", () => {
  it("validates input and returns a failure instead of throwing", async () => {
    const greet = usecase({
      name: "greet",
      input: z.object({ name: z.string() }),
      handle: (_deps, input) => Result.ok(`hi ${input.name}`),
    });
    const result = await greet.run({ name: 5 }, {}).run();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(
        result.match(
          () => null,
          (e) => e.tag,
        ),
      ).toBe("domain.validation");
    }
  });

  it("detects a missing dependency", async () => {
    const saveNote = usecase({
      name: "saveNote",
      deps: ["notes"],
      handle: (deps, input) => deps.notes.save(input),
    });
    const result = await saveNote.run({ text: "t" }, {}).run();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(
        result.match(
          () => null,
          (e) => e.data,
        ),
      ).toEqual({ missing: ["notes"] });
    }
  });

  it("binds dependencies once and runs repeatedly", async () => {
    const save = async () => Result.ok(undefined);
    const saveNote = usecase({
      name: "saveNote",
      deps: ["notes"],
      handle: (deps, input) => deps.notes.save(input),
    });
    const runner = saveNote.with({ notes: { save } });
    expect((await runner({ text: "a" }).run()).isOk()).toBe(true);
    expect((await runner({ text: "b" }).run()).isOk()).toBe(true);
  });

  it("registers a domain.usecase node with its kind", () => {
    command({ name: "create", handle: () => Result.ok(undefined) });
    query({ name: "read", handle: () => Result.ok(undefined) });
    const nodes = lookupAll("domain.usecase");
    expect(nodes.map((n) => n.data.kind).sort()).toEqual(["command", "query"]);
  });

  it("defines a usecase", async () => {
    // #section - Define a usecase
    const greet = usecase({
      name: "greet",
      input: z.object({ name: z.string() }),
      handle: (_deps, input) => Result.ok(`hello ${input.name}`),
    });
    const greeting = await greet.run({ name: "smite" }, {}).run();
    // #endsection

    expect(
      greeting.match(
        (value) => value,
        () => "",
      ),
    ).toBe("hello smite");
  });

  it("binds dependencies to a usecase", async () => {
    // #section - Bind dependencies to a usecase
    const notes = { save: async () => Result.ok(undefined) };
    const saveNote = usecase({
      name: "saveNote",
      deps: ["notes"],
      handle: (deps, input) => deps.notes.save(input),
    });
    const runner = saveNote.with({ notes });
    const result = await runner({ text: "hi" }).run();
    // #endsection

    expect(result.isOk()).toBe(true);
  });
});

describe("handlers", () => {
  it("maps a usecase result to a response and failure to an error status", async () => {
    const echo = usecase({
      name: "echo",
      handle: (_deps, input) => Result.ok({ echo: input }),
    });
    const echoHandler = handler(echo, {});

    const ok = await echoHandler({ body: "ping" });
    expect(ok).toEqual({ status: 200, body: { echo: "ping" } });

    const fail = handler(
      usecase({ name: "boom", handle: () => Result.err("denied", {}) }),
      {},
      { errorStatus: 403 },
    );
    expect((await fail({ body: {} })).status).toBe(403);
  });

  it("relates an http.handler to its domain.usecase in collect mode", () => {
    // #section - Relate a handler to a usecase
    const app = http.app();
    const route = http.route(app);
    const place = usecase({
      name: "place",
      handle: () => Result.ok(undefined),
    });
    route.accept("POST", "/orders").handler(handler(place, {}));
    // #endsection

    const edges = relationships().filter(
      (r) => r.data.relation === "domain.usecase",
    );
    expect(edges.length).toBe(1);
    expect(edges[0]?.data.to).toBe("place");
  });

  it("wires a usecase to a handler", async () => {
    // #section - Wire a usecase to a handler
    const echo = usecase({
      name: "echo",
      handle: (_deps, input) => Result.ok({ echo: input }),
    });
    const httpHandler = handler(echo, {});
    const response = await httpHandler({ body: "hi" });
    // #endsection

    expect(response.status).toBe(200);
  });
});
