import { domain } from "@smitejs/domain";
import { Result } from "@smitejs/fp";
import { z } from "zod";

export const OrderId = domain.valueObject({
  name: "OrderId",
  schema: z.string().min(1),
});

export const Order = domain.entity({
  name: "Order",
  id: "id",
  schema: z.object({
    id: z.string().min(1),
    sku: z.string().min(1),
    qty: z.number().int().positive(),
    status: z.enum(["pending", "placed"]),
  }),
});

export const withinCartLimit = domain.specification({
  name: "withinCartLimit",
  predicate: (input) =>
    input.qty <= 12 ? Result.ok(true) : Result.err("cart-limit", { max: 12 }),
});

export const OrderRepository = domain.port({
  name: "OrderRepository",
  methods: ["findById", "save"],
});

export const makeStore = () => {
  const orders = new Map();
  return {
    findById: async (id) => Result.ok(orders.get(id) ?? null),
    save: async (order) => {
      orders.set(order.id, order);
      return Result.ok(undefined);
    },
  };
};
