import { lifecycle } from "@smite/core";
import type { HttpExecutionContext, LifecycleEntryBuilder } from "@smite/core";
import { Option, extractorMetadata } from "@smite/fp";
import type { Extractor, ExtractorMetadata } from "@smite/fp";
import { freeze } from "./internal/freeze.js";

/**
 * A value that may be produced synchronously or asynchronously.
 *
 * @group Authentication
 */
export type MaybePromise<Value> = PromiseLike<Value> | Value;

/**
 * Minimal principal produced by authentication.
 *
 * The shape is an open record so provider-specific claims (including future
 * OpenID claims) flow through unchanged.
 *
 * @group Authentication
 */
export interface AuthPrincipal {
  readonly sub?: string;
  readonly [claim: string]: unknown;
}

/**
 * Function that turns a credential into a principal.
 *
 * Returning `undefined` (or a promise of it) rejects the credential.
 * Verification is application code: connect Jose, Web Crypto, Passport or any
 * other provider here.
 *
 * @group Authentication
 */
export type Authenticator<Principal = AuthPrincipal> = (
  credential: string,
  context: HttpExecutionContext,
) => MaybePromise<Principal | undefined>;

/**
 * A named strategy binding a verifier to an identifier.
 *
 * Strategies are the extension point of `@smite/auth`. The package never
 * knows how a credential is verified; the strategy function owns that.
 *
 * @group Authentication
 */
export interface AuthenticationStrategy<Principal = AuthPrincipal> {
  readonly name: string;
  readonly authenticate: Authenticator<Principal>;
}

/**
 * Creates an immutable strategy from a name and an authenticator.
 *
 * @group Authentication
 * @intent Defines how a credential is turned into a principal without coupling `@smite/auth` to a provider.
 * @example Connect a strategy
 */
export const strategy = <Principal = AuthPrincipal>(
  name: string,
  authenticate: Authenticator<Principal>,
): AuthenticationStrategy<Principal> => freeze({ name, authenticate });

/**
 * Tries strategies in order and returns the first principal found.
 *
 * Order matters: prefer the most trusted strategy first. If every strategy
 * rejects the credential, the result is `undefined`.
 *
 * @group Authentication
 * @intent Composes independent verifiers into one fallback strategy.
 * @example Compose strategies with anyOf
 */
export const anyOf = <Principal = AuthPrincipal>(
  ...strategies: readonly AuthenticationStrategy<Principal>[]
): AuthenticationStrategy<Principal> => {
  const name =
    strategies.length === 0
      ? "anyOf()"
      : `anyOf(${strategies.map((candidate) => candidate.name).join(", ")})`;

  const authenticate: Authenticator<Principal> = async (
    credential,
    context,
  ) => {
    for (const candidate of strategies) {
      const principal = await candidate.authenticate(credential, context);
      if (principal !== undefined) {
        return principal;
      }
    }

    return undefined;
  };

  return freeze({ name, authenticate });
};

/**
 * Claim accessors bound to one authenticated session.
 *
 * @group Authentication
 * @example Read a claim
 */
export interface SessionClaims {
  readonly claim: (key: string) => Extractor<HttpExecutionContext, string>;
}

/**
 * Handle returned by {@link authenticate}, binding the session name to its
 * provider and rule helpers.
 *
 * The provider stores the verified principal in `context.state[name]`.
 * `claims`, `role` and `owns` read that principal, and `guard` wraps any rule
 * into a lifecycle guard bound to the session.
 *
 * @group Authentication
 * @intent Exposes the lifecycle provider plus claim and rule helpers bound to one session.
 * @example Authorize with roles and ownership
 * @example Guard a controller
 */
export interface Session<Principal = AuthPrincipal> {
  readonly provider: LifecycleEntryBuilder<"provider">;
  readonly claims: SessionClaims;
  readonly role: (
    roleName: string,
  ) => (context: HttpExecutionContext) => boolean;
  readonly owns: (
    claim: string,
    source: Extractor<HttpExecutionContext, string>,
  ) => (context: HttpExecutionContext) => boolean;
  readonly guard: (
    rule: (context: HttpExecutionContext) => MaybePromise<boolean>,
  ) => LifecycleEntryBuilder<"guard">;
}

/**
 * Binds a credential source and a strategy into a session handle.
 *
 * The provider verifies the credential on every request and stores the
 * principal in `context.state[name]`, seeding guards and handlers declared
 * after it. A missing credential stores no principal, so guards deny.
 *
 * @group Authentication
 * @intent Composes credential extraction, verification and authorization into one reusable session.
 * @example Authenticate a session
 */
export const authenticate = <Principal = AuthPrincipal>(
  name: string,
  credentialSource: Extractor<HttpExecutionContext, string>,
  verification: AuthenticationStrategy<Principal>,
): Session<Principal> => {
  const provider = lifecycle.provider(name, async (context) => {
    const credential = credentialSource(context);
    if (credential.isNone()) {
      return undefined;
    }

    return verification.authenticate(credential.unwrapOr(""), context);
  });

  const principalOf = (context: HttpExecutionContext): Principal | undefined =>
    context.state[name] as Principal | undefined;

  const claim = (key: string): Extractor<HttpExecutionContext, string> => {
    const extractor = ((context: HttpExecutionContext) => {
      const principal = principalOf(context);
      if (principal === undefined || principal === null) {
        return Option.none<string>();
      }

      const value = (principal as Record<string, unknown>)[key];
      return typeof value === "string" ? Option.some(value) : Option.none();
    }) as Extractor<HttpExecutionContext, string>;

    Object.defineProperty(extractor, extractorMetadata, {
      configurable: false,
      enumerable: false,
      value: freeze({
        kind: "fp.extractor",
        source: "custom",
        key,
      } satisfies ExtractorMetadata),
    });

    return extractor;
  };

  const role =
    (roleName: string) =>
    (context: HttpExecutionContext): boolean => {
      const principal = principalOf(context);
      if (principal === undefined || principal === null) {
        return false;
      }

      return (principal as Record<string, unknown>).role === roleName;
    };

  const owns =
    (claimName: string, source: Extractor<HttpExecutionContext, string>) =>
    (context: HttpExecutionContext): boolean => {
      const principal = principalOf(context);
      if (principal === undefined || principal === null) {
        return false;
      }

      const value = (principal as Record<string, unknown>)[claimName];
      if (typeof value !== "string") {
        return false;
      }

      return source(context).unwrapOr("") === value;
    };

  const guard = (
    rule: (context: HttpExecutionContext) => MaybePromise<boolean>,
  ): LifecycleEntryBuilder<"guard"> =>
    lifecycle.guard(name, (context) => rule(context));

  return freeze({
    provider,
    claims: freeze({ claim }),
    role,
    owns,
    guard,
  });
};
