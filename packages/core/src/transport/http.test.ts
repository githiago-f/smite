import { describe, expect, it } from "vitest";
import { http, lifecycle, mergeLifecycleDescriptors } from "../index.js";

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
      .use(authenticated)
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

  it("preserves custom lifecycle implementations on controller and route descriptors", () => {
    const validateUserInput = ({ body }: { readonly body: unknown }) => body;
    const localizeHttpErrors = (
      error: Error,
      { locale }: { readonly locale: string },
    ) => ({
      message: `${locale}:${error.message}`,
    });

    const validation = lifecycle.pipe(
      "validate-user-input",
      validateUserInput,
      { source: "http.body" },
    );
    const errors = lifecycle.filter("localized-errors", localizeHttpErrors, {
      dictionary: "errors",
    });

    const controller = http
      .controller()
      .use(lifecycle.create().pipes(validation).filters(errors))
      .path("/users")
      .routes(http.route.post("/", createUser).use(lifecycle.guard("jwt")));

    const [route] = controller.descriptor.routes;
    if (!route) {
      throw new Error("expected route to exist");
    }

    const merged = mergeLifecycleDescriptors(
      controller.descriptor.lifecycle,
      route.lifecycle,
    );

    expect(controller.descriptor.lifecycle.entries).toEqual([
      validation.descriptor,
      errors.descriptor,
    ]);
    expect(merged.entries.map((entry) => entry.implementation)).toEqual([
      validateUserInput,
      localizeHttpErrors,
      undefined,
    ]);
    expect(merged.entries.map((entry) => entry.entryKind)).toEqual([
      "pipe",
      "filter",
      "guard",
    ]);
  });

  it("does not mutate earlier controller builders", () => {
    const base = http.controller();
    const users = base.path("/users");

    expect(base.descriptor.path).toBe("");
    expect(users.descriptor.path).toBe("/users");
  });
});
