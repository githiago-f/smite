import { domain } from "@smitejs/domain";
import { Result } from "@smitejs/fp";
import { http } from "@smitejs/http";
import { z } from "zod";
import {
  Order,
  OrderRepository,
  makeStore,
  withinCartLimit,
} from "./domain.mjs";

export const buildApp = () => {
  const store = makeStore();
  const deps = { [OrderRepository.name]: store };

  const placeOrder = domain.command({
    name: "placeOrder",
    input: z.object({
      sku: z.string().min(1),
      qty: z.number().int().positive(),
    }),
    deps: [OrderRepository.name],
    handle: async ({ [OrderRepository.name]: orders }, input) => {
      const check = await withinCartLimit.isSatisfiedBy(input);
      if (check.isErr()) {
        return Result.err("cart-limit", { max: 12 });
      }
      const order = Order.create({
        id: crypto.randomUUID(),
        sku: input.sku,
        qty: input.qty,
        status: "pending",
      }).unwrapOr(null);
      if (order === null) {
        return Result.err("domain.validation", {});
      }
      return (await orders.save(order)).map(() => ({
        id: order.id,
        sku: order.sku,
        qty: order.qty,
        status: order.status,
      }));
    },
  });

  const getOrder = domain.query({
    name: "getOrder",
    input: z.object({ id: z.string().min(1) }),
    deps: [OrderRepository.name],
    handle: async ({ [OrderRepository.name]: orders }, { id }) => {
      const found = await orders.findById(id);
      if (found.isErr()) {
        return found;
      }
      const value = found.unwrapOr(null);
      return value === null
        ? Result.err("not-found", { id })
        : Result.ok(value);
    },
  });

  const app = http.app("orders");
  const route = http.router().input({
    body: z
      .object({ sku: z.string().min(1), qty: z.number().int().positive() })
      .optional(),
    params: z.object({ id: z.string().min(1) }).partial(),
  });

  route.accept("POST", "/orders").handler(domain.handler(placeOrder, deps));
  route
    .accept("GET", "/orders/:id")
    .handler(domain.handler(getOrder, deps, { input: (ctx) => ctx.params }));

  app.use(route);

  return { app, router: app.serve() };
};
