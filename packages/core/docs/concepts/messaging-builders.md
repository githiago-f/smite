---
title: Messaging Builders
summary: Functional builders for messaging consumers.
order: 25
---

Messaging builders describe queue consumers as immutable semantic metadata. They do not connect brokers, poll queues or execute runtime pipelines.

Consumers group queue bindings, handler references and reusable lifecycle policy. The compiler can later merge those descriptors into generated runtime code for a specific transport.

## Lifecycle policy

Messaging consumers can reuse the same lifecycle compositions used by HTTP controllers and other future transports.

@example Messaging consumer with lifecycle

## Immutability

Each builder call returns a new builder. Shared consumer builders can therefore be reused safely across modules.

@example Messaging consumer with lifecycle
