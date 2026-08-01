import { chain } from "@smite/fp";
import { describe, expect, it } from "vitest";
import { http, lifecycle, mergeLifecycleDescriptors } from "../index.js";
import type { HttpExecutionContext, HttpExecutionRequest } from "../types.js";

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

describe("http extractors", () => {
  it("extracts a cookie value", () => {
    // #section - Extract a cookie
    const session = http.cookie("session_id");
    const context = createContext({ cookies: { session_id: "abc123" } });
    const value = session(context);
    // #endsection

    expect(value.unwrapOr("missing")).toBe("abc123");
    expect(http.cookie("unknown")(context).isNone()).toBe(true);
  });

  it("extracts a header value case-insensitively", () => {
    // #section - Extract a header
    const apiKey = http.header("X-API-Key");
    const context = createContext({ headers: { "x-api-key": "local-dev" } });
    const value = apiKey(context);
    // #endsection

    expect(value.unwrapOr("missing")).toBe("local-dev");
    expect(http.header("accept")(createContext()).isNone()).toBe(true);
  });

  it("extracts the first element of an array-valued header", () => {
    const value = http.header("x-tag")(
      createContext({ headers: { "x-tag": ["a", "b"] } }),
    );

    expect(value.unwrapOr("missing")).toBe("a");
  });

  it("extracts a query parameter", () => {
    // #section - Extract a query parameter
    const page = http.query("page");
    const context = createContext({ query: { page: "2" } });
    const value = page(context);
    // #endsection

    expect(value.unwrapOr("missing")).toBe("2");
    expect(
      http
        .query("page")(createContext({ query: { page: 2 } }))
        .isNone(),
    ).toBe(true);
  });

  it("extracts a path parameter", () => {
    // #section - Extract a path parameter
    const userId = http.param("userId");
    const context = createContext({ params: { userId: "42" } });
    const value = userId(context);
    // #endsection

    expect(value.unwrapOr("missing")).toBe("42");
    expect(http.param("id")(createContext()).isNone()).toBe(true);
  });

  it("extracts a token from the Authorization header", () => {
    // #section - Extract an authorization scheme
    const bearer = http.authHeader("Bearer");
    const context = createContext({
      headers: { authorization: "Bearer abc123" },
    });
    const token = bearer(context);
    // #endsection

    expect(token.unwrapOr("missing")).toBe("abc123");
    expect(
      http
        .authHeader("Bearer")(
          createContext({ headers: { authorization: "Basic dXNlcg==" } }),
        )
        .isNone(),
    ).toBe(true);
    expect(
      http
        .authHeader()(
          createContext({ headers: { authorization: "Basic dXNlcg==" } }),
        )
        .unwrapOr("missing"),
    ).toBe("Basic dXNlcg==");
  });

  it("extracts with a custom reader", () => {
    // #section - Custom extractor
    const locale = http.custom("locale", (context) => {
      const value = context.request.headers["accept-language"];
      return typeof value === "string" ? value : null;
    });
    const context = createContext({
      headers: { "accept-language": "en-US" },
    });
    const value = locale(context);
    // #endsection

    expect(value.unwrapOr("missing")).toBe("en-US");
    expect(locale(createContext()).isNone()).toBe(true);
  });

  it("composes extractors with chain", () => {
    // #section - Compose extractors with chain
    const sessionId = chain(
      http.cookie("session_id"),
      http.header("x-session-id"),
    );
    const context = createContext({
      headers: { "x-session-id": "header-id" },
    });
    const value = sessionId(context);
    // #endsection

    expect(value.unwrapOr("missing")).toBe("header-id");
    expect(sessionId(createContext()).isNone()).toBe(true);
  });
});

describe("extractors in lifecycle components", () => {
  it("uses an extractor inside a guard", () => {
    // #section - Extract in a guard
    const sessionId = chain(
      http.cookie("session_id"),
      http.header("x-session-id"),
    );
    const Authenticated = lifecycle.guard("authenticated", (context) =>
      sessionId(context).isSome(),
    );
    // #endsection

    const implementation = Authenticated.descriptor.implementation as (
      context: HttpExecutionContext,
    ) => boolean;
    expect(
      implementation(createContext({ cookies: { session_id: "abc123" } })),
    ).toBe(true);
    expect(implementation(createContext())).toBe(false);
  });

  it("uses an extractor inside a filter", () => {
    // #section - Extract in a filter
    const locale = http.header("accept-language");
    const LocalizedErrors = lifecycle.filter(
      "localized-errors",
      (error: Error, context) => ({
        status: 400,
        body: {
          locale: locale(context).unwrapOr("en"),
          message: error.message,
        },
      }),
    );
    // #endsection

    const implementation = LocalizedErrors.descriptor.implementation as (
      error: Error,
      context: HttpExecutionContext,
    ) => { readonly status: number; readonly body: Record<string, unknown> };
    expect(
      implementation(
        new Error("bad input"),
        createContext({ headers: { "accept-language": "pt-BR" } }),
      ),
    ).toEqual({
      status: 400,
      body: { locale: "pt-BR", message: "bad input" },
    });
    expect(
      implementation(new Error("bad input"), createContext()).body.locale,
    ).toBe("en");
  });

  it("uses an extractor inside a provider", () => {
    // #section - Extract in a provider
    const apiKey = chain(http.header("x-api-key"), http.cookie("api_key"));
    const ApiKeyProvider = lifecycle.provider("api-key", (context) =>
      apiKey(context).unwrapOr(""),
    );
    // #endsection

    const implementation = ApiKeyProvider.descriptor.implementation as (
      context: HttpExecutionContext,
    ) => string;
    expect(
      implementation(createContext({ headers: { "x-api-key": "local-dev" } })),
    ).toBe("local-dev");
    expect(implementation(createContext())).toBe("");
  });

  it("uses an extractor inside a pipe", () => {
    // #section - Extract in a pipe
    const userId = chain(http.cookie("user_id"), http.param("userId"));
    const AttachUser = lifecycle.pipe("attach-user", (body, context) => ({
      ...(body as Record<string, unknown>),
      userId: userId(context).unwrapOr("anonymous"),
    }));
    // #endsection

    const implementation = AttachUser.descriptor.implementation as (
      body: unknown,
      context: HttpExecutionContext,
    ) => Record<string, unknown>;
    expect(
      implementation(
        { name: "Lin" },
        createContext({ cookies: { user_id: "42" } }),
      ),
    ).toEqual({ name: "Lin", userId: "42" });
    expect(implementation({ name: "Lin" }, createContext()).userId).toBe(
      "anonymous",
    );
  });

  it("uses an extractor inside an interceptor", () => {
    const audits: string[] = [];
    // #section - Extract in an interceptor
    const requestId = http.header("x-request-id");
    const AuditRequest = lifecycle.interceptor("audit-request", (context) => {
      requestId(context).tap((id) => audits.push(`request:${id}`));
    });
    // #endsection

    const implementation = AuditRequest.descriptor.implementation as (
      context: HttpExecutionContext,
    ) => void;
    implementation(createContext({ headers: { "x-request-id": "req-1" } }));
    implementation(createContext());
    expect(audits).toEqual(["request:req-1"]);
  });
});

const createContext = (
  request: Partial<HttpExecutionRequest> = {},
): HttpExecutionContext => ({
  request: {
    method: "GET",
    path: "/",
    headers: {},
    cookies: {},
    query: {},
    params: {},
    body: undefined,
    raw: undefined,
    ...request,
  },
  state: {},
});
