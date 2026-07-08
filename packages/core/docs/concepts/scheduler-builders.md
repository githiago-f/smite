---
title: Scheduler Builders
summary: Functional builders for scheduled jobs.
order: 26
---

Scheduler builders describe time-driven jobs as immutable semantic metadata. They do not create timers, manage workers or execute runtime pipelines.

Jobs group cron expressions, handler references and reusable lifecycle policy. The compiler can later translate those descriptors into generated runtime code for a specific scheduling target.

## Lifecycle policy

Scheduler jobs can reuse the same lifecycle compositions used by HTTP controllers and other future transports.

@example Scheduled job with lifecycle

## Immutability

Each builder call returns a new builder. Shared job builders can therefore be reused safely across modules.

@example Scheduled job with lifecycle
