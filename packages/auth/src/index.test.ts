import { http, executeHttpPipeline, lifecycle } from "@smite/core";
import type {
  HttpExecutionContext,
  HttpExecutionRequest,
  HttpExecutionResult,
} from "@smite/core";
import { chain, or } from "@smite/fp";
import { describe, expect, it } from "vitest";
import { anyOf, authenticate, strategy } from "./index.js";
import type { AuthPrincipal } from "./index.js";

const verifyToken = async (
  token: string,
): Promise<AuthPrincipal | undefined> => {
  if (token === "valid-token") {
    return { sub: "7" };
  }

  if (token === "admin-token") {
    return { sub: "admin-1", role: "admin" };
  }

  if (token === "owner-token") {
    return { sub: "42", role: "user" };
  }

  return undefined;
};

const Jwt = strategy("jose", (token) => verifyToken(token));
const ApiKey = strategy("api-key", (key) =>
  key.startsWith("sk:") ? { sub: key, role: "service" } : undefined,
);

const viewProfile = (context: HttpExecutionContext) => ({
  profileId: context.request.params.profileId,
});

describe("strategy", () => {
  it("creates a frozen strategy with a name and authenticator", async () => {
    // #section - Connect a strategy
    const Jwt = strategy("jose", async (token) => {
      const payload = await verifyToken(token);
      return payload;
    });
    // #endsection

    expect(Jwt.name).toBe("jose");
    await expect(
      Jwt.authenticate("valid-token", createContext()),
    ).resolves.toEqual({ sub: "7" });
    await expect(Jwt.authenticate("bad-token", createContext())).resolves.toBe(
      undefined,
    );
    expect(Object.isFrozen(Jwt)).toBe(true);
  });
});

describe("anyOf", () => {
  it("composes strategies with first-wins ordering", async () => {
    // #section - Compose strategies with anyOf
    const AnySession = anyOf(Jwt, ApiKey);
    // #endsection

    await expect(
      AnySession.authenticate("valid-token", createContext()),
    ).resolves.toEqual({ sub: "7" });
    await expect(
      AnySession.authenticate("sk:live", createContext()),
    ).resolves.toEqual({ sub: "sk:live", role: "service" });
    await expect(
      AnySession.authenticate("unknown", createContext()),
    ).resolves.toBe(undefined);
    expect(AnySession.name).toBe("anyOf(jose, api-key)");
  });

  it("tries strategies in order", async () => {
    const First = strategy("first", () => ({ sub: "first" }));
    const Second = strategy("second", () => ({ sub: "second" }));

    const Both = anyOf(First, Second);
    expect(await Both.authenticate("", createContext())).toEqual({
      sub: "first",
    });

    const Fallback = anyOf(
      strategy("failing", () => undefined),
      Second,
    );
    expect(await Fallback.authenticate("", createContext())).toEqual({
      sub: "second",
    });

    const None = anyOf(
      strategy("a", () => undefined),
      strategy("b", () => undefined),
    );
    expect(await None.authenticate("", createContext())).toBe(undefined);
  });
});

describe("authenticate", () => {
  it("stores the verified principal in state through the provider", async () => {
    // #section - Authenticate a session
    const Session = authenticate(
      "session",
      chain(http.authHeader("Bearer"), http.cookie("session_token")),
      Jwt,
    );
    // #endsection

    const implementation = Session.provider.descriptor.implementation as (
      context: HttpExecutionContext,
    ) => Promise<AuthPrincipal | undefined>;

    const withBearer = createContext({
      headers: { authorization: "Bearer valid-token" },
    });
    expect(await implementation(withBearer)).toEqual({ sub: "7" });

    const withCookie = createContext({
      cookies: { session_token: "valid-token" },
    });
    expect(await implementation(withCookie)).toEqual({ sub: "7" });

    expect(await implementation(createContext())).toBe(undefined);
    expect(Session.provider.descriptor.entryKind).toBe("provider");
  });

  it("awaits async authenticators before storing the principal", async () => {
    const Session = authenticate("session", http.authHeader("Bearer"), Jwt);
    const implementation = Session.provider.descriptor.implementation as (
      context: HttpExecutionContext,
    ) => unknown;

    const principal = await implementation(
      createContext({ headers: { authorization: "Bearer valid-token" } }),
    );
    expect(principal).toEqual({ sub: "7" });
  });
});

describe("session claims", () => {
  it("reads a string claim from the session principal", () => {
    const context = createContext({}, { session: { sub: "42", role: "user" } });

    // #section - Read a claim
    const Session = authenticate("session", http.authHeader("Bearer"), Jwt);
    const subject = Session.claims.claim("sub");
    const ownSubject = subject(context);
    // #endsection

    expect(ownSubject.unwrapOr("none")).toBe("42");
    expect(subject(createContext({}, { session: { sub: 42 } })).isNone()).toBe(
      true,
    );
    expect(subject(createContext()).isNone()).toBe(true);
  });
});

describe("authorization", () => {
  it("checks role against the session principal", () => {
    const Session = authenticate("session", http.authHeader("Bearer"), Jwt);

    const isAdmin = Session.role("admin");
    expect(isAdmin(createContext({}, { session: { role: "admin" } }))).toBe(
      true,
    );
    expect(isAdmin(createContext({}, { session: { role: "user" } }))).toBe(
      false,
    );
    expect(isAdmin(createContext())).toBe(false);
  });

  it("checks ownership against an extracted value", () => {
    const Session = authenticate("session", http.authHeader("Bearer"), Jwt);
    const profileId = http.query("profileId");

    const isOwner = Session.owns("sub", profileId);
    expect(
      isOwner(
        createContext(
          { query: { profileId: "42" } },
          { session: { sub: "42" } },
        ),
      ),
    ).toBe(true);
    expect(
      isOwner(
        createContext(
          { query: { profileId: "99" } },
          { session: { sub: "42" } },
        ),
      ),
    ).toBe(false);
    expect(
      isOwner(
        createContext({ query: { profileId: "42" } }, { session: { sub: 42 } }),
      ),
    ).toBe(false);
  });
});

describe("guarded pipeline", () => {
  it("authorizes admins and owners through the execution pipeline", async () => {
    // #section - Authorize with roles and ownership
    const Session = authenticate(
      "session",
      chain(http.authHeader("Bearer"), http.cookie("session_token")),
      Jwt,
    );
    const profileId = chain(
      http.param("profileId"),
      http.query("profileId"),
      Session.claims.claim("sub"),
    );
    const OwnerOrAdmin = Session.guard(
      or(Session.role("admin"), Session.owns("sub", profileId)),
    );
    // #endsection

    // #section - Guard a controller
    const UsersController = http
      .controller()
      .use(lifecycle.create().providers(Session.provider).guards(OwnerOrAdmin))
      .path("/users")
      .routes(http.route.get("/:profileId", viewProfile));
    // #endsection

    const [route] = UsersController.descriptor.routes;
    if (!route) {
      throw new Error("expected route to exist");
    }

    const run = async (
      request: Partial<HttpExecutionRequest>,
    ): Promise<HttpExecutionResult> =>
      executeHttpPipeline(
        UsersController.descriptor,
        route,
        createContext(request),
      );

    const asAdmin = await run({
      headers: { authorization: "Bearer admin-token" },
    });
    expect(asAdmin.status).not.toBe(403);

    const asOwner = await run({
      headers: { authorization: "Bearer owner-token" },
      params: { profileId: "42" },
    });
    expect(asOwner.status).not.toBe(403);
    expect(asOwner.body).toEqual({ profileId: "42" });

    const asStranger = await run({
      headers: { authorization: "Bearer owner-token" },
      params: { profileId: "99" },
    });
    expect(asStranger.status).toBe(403);

    const anonymous = await run({});
    expect(anonymous.status).toBe(403);
  });
});

const createContext = (
  request: Partial<HttpExecutionRequest> = {},
  state: Readonly<Record<string, unknown>> = {},
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
  state,
});
