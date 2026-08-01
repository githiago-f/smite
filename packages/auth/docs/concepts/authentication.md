---
title: Authentication
summary: Compose credential extraction, verification and authorization through pluggable strategies.
order: 10
---

Authentication in Smite is decomposed into four composable steps: read a credential from the request, verify it with a strategy, store the principal in state, and authorize against it. `@smite/auth` provides the pattern; your strategy functions decide how verification actually works.

## Strategy

A strategy is a name and a plain function that turns a credential into a principal. Returning `undefined` rejects the credential. Verification is always application code, so Jose, Web Crypto, Passport or any custom verifier are drop-ins.

@example Connect a strategy

## Session

Bind a credential source and a strategy into a session handle. The handle exposes a provider that stores the verified principal in `context.state`, plus helpers bound to that session.

@example Authenticate a session

## Composing strategies

Use `anyOf` to try independent strategies in order. The first strategy that produces a principal wins.

@example Compose strategies with anyOf

## Reading claims

Claim extractors read string values from the stored principal, so they compose with `chain` like any other extractor.

@example Read a claim

## Authorization

Rules are pure predicates over the execution context. `role` checks a claim, `owns` compares a claim against an extracted value, and `guard` wraps any rule into a lifecycle guard. Compose rules with predicates from `@smite/fp`.

@example Authorize with roles and ownership

## Guarding a controller

Wire the session provider and guards into a controller. The provider must be declared before the guards that read its principal.

@example Guard a controller

## Runtime behavior

The provider resolves the credential on every request, awaits the strategy, and stores the principal in `context.state[name]`. A missing credential or a rejected credential stores no principal, so guards deny the request. Errors thrown by a strategy flow to lifecycle filters like any other failure.
