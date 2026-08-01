# Feature Request — `@smite/auth`

## Summary

Introduce a provider-agnostic authentication runtime plugin for Smite.

Authentication is decomposed into four composable steps that reuse the primitives already provided by `@smite/core` and `@smite/fp`:

1. **Credential source** — a `chain` of HTTP extractors that locates a credential (`authHeader`, `cookie`, `query`, ...).
2. **Strategy** — a user-supplied function that turns a credential into a principal, or returns nothing when the credential is rejected.
3. **Session** — a lifecycle provider that verifies the credential and stores the principal in `context.state`.
4. **Rule** — a lifecycle guard that authorizes the request against the stored principal and request-derived values.

The strategy is the extension point. Users connect Jose, Web Crypto, Passport, OpenID, or any other provider by writing a single function. The package ships no crypto code and no built-in strategies; it only holds the authentication pattern.

The proposed package name is:

```
@smite/auth
```

---

# Motivation

Authentication frameworks usually dictate a specific protocol or force a chosen library down the stack. Smite should do neither.

Applications already express intent through extractors and lifecycle components. Authentication is the same shape: read a credential from a request, verify it, and authorize against the result. Every variation — JWT via Jose, JWT via Web Crypto, opaque sessions, API keys, Passport, OIDC — differs only in how the credential is verified.

By modeling authentication as *extraction → strategy → state → rule*, `@smite/auth` lets each application decide how its authentication method works while keeping the surrounding pattern reusable and compile-time friendly.

---

# Goals

* Decompose authentication into extraction, verification, and authorization.
* Let users decide how their authentication method works.
* Support any verifier: Jose, Web Crypto, Passport, OpenID, or custom.
* Reuse existing primitives rather than inventing new machinery:

  * `chain` and HTTP extractors for credential sources;
  * `lifecycle.provider` for storing the verified principal;
  * `lifecycle.guard` for authorization;
  * `@smite/fp` predicates for composing rules.

* Keep the public API small and discoverable.
* Preserve strong TypeScript inference with few explicit annotations.
* Produce zero runtime framework state.

---

# Non-Goals

This package is **not** intended to:

* implement JWT, OpenID Connect, or any specific protocol;
* ship built-in crypto or claim/algorithm checks;
* replace Passport, Jose, or similar libraries;
* manage user stores, credentials, or sessions itself;
* introduce runtime dependency injection or containers.

Verification belongs to the user's chosen provider. `@smite/auth` only holds the pattern.

---

# Design Principles

## Strategy over Implementation

The package must never know how a credential is verified. A strategy is a name and a plain function; connecting it to Jose, `crypto.subtle`, Passport, or a remote introspection endpoint is always application code.

## Extraction Separate from Verification

Where a credential comes from (`authHeader`, `cookie`, `query`) is independent of whether it is valid. `@smite/auth` never couples a source to a strategy; the two are composed explicitly at the call site.

## State through Providers

The verified principal is a value in `context.state`, seeded by a lifecycle provider exactly like any other request-scoped value. Nothing in `@smite/auth` manages identity storage or session lifecycles.

## Authorization as Pure Rules

Rules are pure predicates over the context. The package provides small helpers (`role`, `owns`) that compose with `@smite/fp` combinators such as `or` and `and`; it does not invent a rule DSL.

## Strong Type Inference

The `Principal` type should propagate from the strategy through the session handle. Developers should rarely need explicit generic annotations.

---

# Proposed API

## AuthPrincipal

The minimal principal shape is an open record so provider-specific claims (including future OpenID claims) flow through unchanged.

```ts
export interface AuthPrincipal {
  readonly sub?: string;
  readonly [claim: string]: unknown;
}
```

## Strategy

A strategy is a name plus a function. Returning `undefined` (or a promise of it) rejects the credential.

```ts
export interface AuthenticationStrategy<Principal = AuthPrincipal> {
  readonly name: string;
  authenticate(
    credential: string,
    context: HttpExecutionContext,
  ): MaybePromise<Principal | undefined>;
}

export const strategy: <Principal = AuthPrincipal>(
  name: string,
  authenticate: AuthenticationStrategy<Principal>["authenticate"],
) => AuthenticationStrategy<Principal>;
```

Connecting a provider is a single function:

```ts
import { jwtVerify } from "jose";
import { strategy } from "@smite/auth";

const Jwt = strategy("jose", async (token) => {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
  });
  return payload;
});
```

The same shape works for Web Crypto, Passport, or any custom verifier.

## authenticate

Binds a credential source and a strategy into a session handle. The handle exposes a lifecycle provider plus claim and rule helpers bound to the session.

```ts
export const authenticate: <Principal = AuthPrincipal>(
  name: string,
  credentialSource: Extractor<HttpExecutionContext, string>,
  verification: AuthenticationStrategy<Principal>,
) => Session<Principal>;
```

```ts
const Session = authenticate(
  "session",
  chain(http.authHeader("Bearer"), http.cookie("session")),
  Jwt,
);
```

### Session handle

* `provider: LifecycleEntryBuilder<"provider">` — resolves the credential from the source, awaits the strategy, and stores the principal in `context.state[name]`.
* `claims.claim(key): Extractor<HttpExecutionContext, string>` — reads a claim from the stored principal, e.g. the `sub` from the user's own token.
* `role(roleName): (ctx) => boolean` — true when a principal exists and its `role` claim equals `roleName`.
* `owns(claim, source): (ctx) => boolean` — true when `principal[claim]` equals the value extracted by `source` (e.g. `sub` vs. a `profileId` path/query parameter).
* `guard(rule): LifecycleEntryBuilder<"guard">` — wraps a rule predicate into a lifecycle guard.

## anyOf

Strategy fallback composition, mirroring the ordering semantics of `chain` from `@smite/fp`: strategies are tried in order and the first principal wins.

```ts
export const anyOf: (
  ...strategies: AuthenticationStrategy[]
) => AuthenticationStrategy;
```

```ts
const AnySession = anyOf(Jwt, OpaqueApiKey);
```

---

# Composing the Pattern

The pattern composes directly from existing primitives. Authorizing a request when the bearer JWT has role `"admin"` **or** the token's `sub` matches the `profileId` from path or query:

```ts
import { http, lifecycle } from "@smite/core";
import { chain, or } from "@smite/fp";
import { authenticate, strategy } from "@smite/auth";

const Jwt = strategy("jose", async (token) =>
  jwtVerify(token, secret, { algorithms: ["HS256"] }).then(({ payload }) => payload),
);

const Session = authenticate(
  "session",
  chain(http.authHeader("Bearer"), http.cookie("session")),
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

export const UsersController = http
  .controller()
  .use(lifecycle.create().providers(Session.provider).guards(OwnerOrAdmin))
  .path("/users")
  .routes(http.route.get("/:profileId", viewProfile));
```

No rule DSL is introduced: `role`, `owns`, `or` are ordinary functions returning predicates over the execution context.

---

# Runtime Behavior

The provider runs the strategy for every request. A missing credential produces `None` from the source, so the provider stores no principal and the guard denies the request.

The provider awaits the strategy result, so synchronous and asynchronous verifiers behave identically.

Providers seed `context.state` in declaration order, so the provider must be declared before the guards that read its principal. This is the existing lifecycle contract; `@smite/auth` adds no new ordering rules.

---

# Integration

## With `@smite/core`

The package consumes only public core APIs: `HttpExecutionContext`, `lifecycle.provider`, `lifecycle.guard`, and the `http` extractor namespace. No kernel changes are required.

## With `@smite/fp`

Credential sources use `chain` and extractors; rules compose with predicates and combinators. `MaybePromise`, `Option`, and extractor metadata all flow through unchanged.

## With runtime adapters

`@smite/express` already normalizes request data (including cookies) into the execution context. `@smite/auth` only reads that context, so it works on any runtime adapter without modification.

---

# Future Opportunities

Once the pattern is established, built-in conveniences may be added without changing the strategy contract:

* reference JWT strategies backed by Jose and Web Crypto;
* claim and algorithm checks (`exp`, `nbf`, `iss`, `aud`);
* OpenID Connect support built on the same strategy shape.

Each addition is just another strategy; the core pattern stays unchanged.

---

# Success Criteria

The feature will be considered successful if:

* a user can authenticate with Jose, Web Crypto, Passport, or a custom verifier without changing anything but the strategy function;
* credential sources compose with `chain` exactly like plain extractors;
* role and ownership rules compose with `@smite/fp` predicates;
* the verified principal flows through `context.state` with no new runtime state;
* the package introduces no kernel changes to `@smite/core` or `@smite/express`;
* the public API stays small and the docs examples are tested and reproducible.
