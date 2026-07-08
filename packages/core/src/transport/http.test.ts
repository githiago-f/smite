import { describe, expect, it } from "vitest";
import { http, lifecycle } from "../index.js";

const JwtGuard = lifecycle.guard("jwt");
const ValidationPipe = lifecycle.pipe("validation");

const listUsers = () => undefined;
const createUser = () => undefined;

describe("http", () => {
  it("builds immutable controller and route descriptors", () => {
    const authenticated = lifecycle.create().guards(JwtGuard);
    const validated = ValidationPipe;

    const route = http.route.post("/", createUser).use(validated);
    const controller = http
      .controller()
      .use(authenticated.descriptor)
      .path("/users")
      .routes(http.route.get("/", listUsers), route);

    expect(controller.descriptor).toMatchObject({
      kind: "http.controller",
      path: "/users",
    });
    expect(controller.descriptor.lifecycle.entries).toEqual(
      authenticated.descriptor.entries,
    );
    expect(controller.descriptor.routes).toHaveLength(2);
    expect(controller.descriptor.routes[0]).toMatchObject({
      kind: "http.route",
      method: "GET",
      path: "/",
    });
    expect(controller.descriptor.routes[1]?.lifecycle.entries).toEqual([
      validated.descriptor,
    ]);
    expect(Object.isFrozen(controller.descriptor.routes)).toBe(true);
  });

  it("does not mutate earlier controller builders", () => {
    const base = http.controller();
    const users = base.path("/users");

    expect(base.descriptor.path).toBe("");
    expect(users.descriptor.path).toBe("/users");
  });
});
