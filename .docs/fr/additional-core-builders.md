# Feature Request: Core Builder Expansion

## Summary

Continue the core builder model beyond `http` and `lifecycle` by introducing additional transport namespaces for message-driven and time-driven applications.

The new builders must follow the same compile-time-first rules as the current core:

* immutable builder chaining;
* descriptor-first semantics;
* lifecycle composition reuse;
* zero runtime framework state;
* deterministic output for compiler consumption.

---

## Motivation

The current core already models HTTP controllers and reusable lifecycle policies.

That covers request/response applications, but it does not yet express other common execution surfaces that still belong in the semantic layer.

Two obvious next steps are:

* `messaging` for queue consumers;
* `scheduler` for cron-driven jobs.

Both concepts can reuse the existing lifecycle model without introducing runtime containers or bootstrap code.

---

## Goals

* Extend the core DSL with additional transport builders.
* Preserve the same immutable composition model used by `http`.
* Reuse lifecycle descriptors across all transports.
* Keep the public API small and discoverable.
* Avoid runtime discovery or runtime builder execution.

---

## Proposed Builders

### Messaging

The `messaging` namespace should describe queue consumers.

Example:

```ts
const BillingConsumer = messaging
  .consumer()
  .use(authenticated)
  .queue("billing-events")
  .handler(processBilling);
```

The descriptor should capture:

* queue name;
* handler reference;
* lifecycle policy.

### Scheduler

The `scheduler` namespace should describe scheduled jobs.

Example:

```ts
const RefreshCacheJob = scheduler
  .job()
  .use(audited)
  .cron("0 0 * * *")
  .handler(refreshCache);
```

The descriptor should capture:

* cron expression;
* handler reference;
* lifecycle policy.

---

## Compilation

The builders only produce semantic descriptors.

The compiler should later merge lifecycle policy and transport descriptors into a normalized model consumed by plugins and runtime emitters.

No runtime merge or dependency injection should be introduced.

---

## Success Criteria

* The core exports `messaging` and `scheduler` namespaces.
* Both namespaces expose immutable builders.
* Both builders support lifecycle composition through `.use(...)`.
* Documentation examples are tested and reproducible.
* The new builders fit the existing descriptor architecture without widening runtime cost.

