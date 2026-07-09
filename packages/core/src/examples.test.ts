import { describe, expect, it } from "vitest";
import {
  http,
  lifecycle,
  mergeLifecycleDescriptors,
} from "./index.js";
import type {
  HttpExecutionContext,
  InputSchema,
  RouteHandlerContext,
  RouteInputConfig,
} from "./index.js";

describe("examples", () => {
  it("builds a reusable lifecycle composition", () => {
    // #section - Reusable lifecycle composition
    const JwtGuard = lifecycle.guard("jwt");
    const HttpErrorsFilter = lifecycle.filter("http-errors");
    const LoggerProvider = lifecycle.provider("logger");

    const authenticated = lifecycle
      .create()
      .guards(JwtGuard)
      .filters(HttpErrorsFilter)
      .providers(LoggerProvider);
    // #endsection

    expect(
      authenticated.descriptor.entries.map((entry) => entry.entryKind),
    ).toEqual(["guard", "filter", "provider"]);
  });

  it("adapts lifecycle components before composition", () => {
    // #section - Lifecycle adapters
    const authenticated = lifecycle.guard("jwt");
    const validation = lifecycle.pipe("validation");
    const audited = lifecycle.interceptor("audit");

    const requestPolicy = lifecycle
      .create()
      .use(authenticated, validation, audited);
    // #endsection

    expect(requestPolicy.descriptor.entries).toEqual([
      authenticated.descriptor,
      validation.descriptor,
      audited.descriptor,
    ]);
  });

  it("captures lifecycle implementations for generated runtimes", () => {
    // #section - Lifecycle implementations
    const UserInput = {
      parse: (input: unknown) => input as { readonly name: string },
    };

    const ValidateUserInput = lifecycle.guard(
      "user-input-validator",
      ({ body }: { readonly body: unknown }) => UserInput.parse(body),
      { source: "http.body" },
    );

    const LocalizedErrors = lifecycle.filter(
      "localized-errors",
      (error: Error, { locale }: { readonly locale: string }) => ({
        message: `${locale}:${error.message}`,
      }),
      { dictionary: "errors" },
    );

    const requestPolicy = lifecycle
      .create()
      .guards(ValidateUserInput)
      .filters(LocalizedErrors);
    // #endsection

    expect(requestPolicy.descriptor.entries).toEqual([
      ValidateUserInput.descriptor,
      LocalizedErrors.descriptor,
    ]);
    expect(
      requestPolicy.descriptor.entries.map((entry) => entry.implementation),
    ).toEqual([
      ValidateUserInput.descriptor.implementation,
      LocalizedErrors.descriptor.implementation,
    ]);
  });

  it("preserves custom lifecycle handlers on an HTTP controller", () => {
    // #section - HTTP controller with custom lifecycle implementations
    const UserInput = {
      parse: (input: unknown) => input as { readonly name: string },
    };

    const ValidateUserInput = lifecycle.pipe(
      "validate-user-input",
      ({ body }: { readonly body: unknown }) => UserInput.parse(body),
      { source: "http.body" },
    );

    const LocalizedErrors = lifecycle.filter(
      "localized-errors",
      (error: Error, { locale }: { readonly locale: string }) => ({
        message: `${locale}:${error.message}`,
      }),
      { dictionary: "errors" },
    );

    const UsersController = http
      .controller()
      .use(lifecycle.create().pipes(ValidateUserInput).filters(LocalizedErrors))
      .path("/users")
      .routes(http.route.post("/", () => undefined));
    // #endsection

    expect(UsersController.descriptor.lifecycle.entries).toEqual([
      ValidateUserInput.descriptor,
      LocalizedErrors.descriptor,
    ]);
    expect(
      UsersController.descriptor.lifecycle.entries.map(
        (entry) => entry.implementation,
      ),
    ).toEqual([
      ValidateUserInput.descriptor.implementation,
      LocalizedErrors.descriptor.implementation,
    ]);
  });

  it("applies lifecycle composition to an HTTP controller", () => {
    // #section - HTTP controller with lifecycle
    const JwtGuard = lifecycle.guard("jwt");
    const authenticated = lifecycle.create().guards(JwtGuard);
    const listUsers = () => undefined;
    const createUser = () => undefined;

    const UsersController = http
      .controller()
      .use(authenticated)
      .path("/users")
      .routes(http.route.get("/", listUsers), http.route.post("/", createUser));
    // #endsection

    expect(UsersController.descriptor).toMatchObject({
      kind: "http.controller",
      path: "/users",
    });
    expect(UsersController.descriptor.lifecycle.entries).toEqual(
      authenticated.descriptor.entries,
    );
    expect(
      UsersController.descriptor.routes.map((route) => route.method),
    ).toEqual(["GET", "POST"]);
  });

  it("applies lifecycle composition to a single HTTP route", () => {
    // #section - Route-specific lifecycle
    const validation = lifecycle.pipe("validation");
    const getUser = ({ id }: { readonly id: string }) => id;

    const GetUserRoute = http.route.get("/:id", getUser).use(validation);
    // #endsection

    expect(GetUserRoute.descriptor).toMatchObject({
      kind: "http.route",
      method: "GET",
      path: "/:id",
    });
    expect(GetUserRoute.descriptor.lifecycle.entries).toEqual([
      validation.descriptor,
    ]);
  });

  it("merges lifecycle descriptors at compile-time boundaries", () => {
    // #section - Descriptor merging
    const JwtGuard = lifecycle.guard("jwt");
    const ValidationPipe = lifecycle.pipe("validation");
    const AuditInterceptor = lifecycle.interceptor("audit");

    const controllerPolicy = lifecycle.create().guards(JwtGuard);
    const routePolicy = lifecycle
      .create()
      .pipes(ValidationPipe)
      .interceptors(AuditInterceptor);

    const mergedPolicy = mergeLifecycleDescriptors(
      controllerPolicy,
      routePolicy,
    );
    // #endsection

    expect(mergedPolicy.entries.map((entry) => entry.entryKind)).toEqual([
      "guard",
      "pipe",
      "interceptor",
    ]);
  });

  it("keeps builders immutable while deriving specialized descriptors", () => {
    // #section - Immutable builder derivation
    const JwtGuard = lifecycle.guard("jwt");

    const api = http.controller().use(JwtGuard);
    const UsersController = api.path("/users");
    const BillingController = api.path("/billing");
    // #endsection

    expect(api.descriptor.path).toBe("");
    expect(UsersController.descriptor.path).toBe("/users");
    expect(BillingController.descriptor.path).toBe("/billing");
    expect(UsersController.descriptor.lifecycle.entries).toEqual(
      BillingController.descriptor.lifecycle.entries,
    );
  });

  it("attaches input schema and auto-generates validation lifecycle", () => {
    // #section - Route input with validation lifecycle
    const schema: InputSchema<{ readonly name: string }> = {
      parse: (input) => input as { readonly name: string },
    };

    const route = http.route
      .post("/users", () => ({ status: 201 }))
      .input({ body: schema });
    // #endsection

    expect(route.descriptor.input).toBeDefined();
    expect(route.descriptor.input?.body).toBe(schema);
    expect(
      route.descriptor.lifecycle.entries.find(
        (entry) => entry.name === "input-body",
      ),
    ).toBeDefined();
  });

  it("composes reusable specs with extend", () => {
    // #section - Reusable route spec
    const schema: InputSchema<{ readonly id: string }> = {
      parse: (input) => input as { readonly id: string },
    };

    const base = http.route.input({
      params: schema,
    });

    const route = http.route.extend(base).get("/:id", () => undefined);
    // #endsection

    expect(route.descriptor.input?.params).toBe(schema);
    expect(
      route.descriptor.lifecycle.entries.find(
        (entry) => entry.name === "input-params",
      ),
    ).toBeDefined();
  });

  it("returns http result objects from handlers", () => {
    // #section - Http result from handler
    const handler = () => http.result(http.NOT_FOUND, { message: "missing" });
    // #endsection

    const result = handler();

    expect(result).toMatchObject({
      kind: "http.result",
      status: 404,
      body: { message: "missing" },
    });
  });

  it("attaches output schemas for documentation", () => {
    // #section - Route output schema
    const UserSchema: InputSchema<{ readonly id: string }> = {
      parse: (input) => input as { readonly id: string },
    };

    const route = http.route
      .get("/users/:id", () => undefined)
      .output({ [http.OK]: UserSchema, [http.NOT_FOUND]: UserSchema });
    // #endsection

    expect(route.descriptor.output?.[http.OK]).toBe(UserSchema);
    expect(route.descriptor.output?.[http.NOT_FOUND]).toBe(UserSchema);
  });
});
