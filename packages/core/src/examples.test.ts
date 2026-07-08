import { describe, expect, it } from "vitest";
import { http, lifecycle, mergeLifecycleDescriptors } from "./index.js";

const JwtGuard = lifecycle.guard("jwt");
const HttpErrorsFilter = lifecycle.filter("http-errors");
const LoggerProvider = lifecycle.provider("logger");
const ValidationPipe = lifecycle.pipe("validation");
const AuditInterceptor = lifecycle.interceptor("audit");

const listUsers = () => undefined;
const createUser = () => undefined;
const getUser = ({ id }: { readonly id: string }) => id;

describe("examples", () => {
  it("builds a reusable lifecycle composition", () => {
    // #section - Reusable lifecycle composition
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

  it("applies lifecycle composition to an HTTP controller", () => {
    const authenticated = lifecycle.create().guards(JwtGuard);

    // #section - HTTP controller with lifecycle
    const UsersController = http
      .controller()
      .use(authenticated.descriptor)
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
    const validation = ValidationPipe;

    // #section - Route-specific lifecycle
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
    const controllerPolicy = lifecycle.create().guards(JwtGuard).descriptor;
    const routePolicy = lifecycle
      .create()
      .pipes(ValidationPipe)
      .interceptors(AuditInterceptor).descriptor;

    // #section - Descriptor merging
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
});
