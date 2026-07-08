# Extensibility

The framework is designed around extension points rather than built-in features.

The kernel should remain small and stable.

New capabilities should be introduced by extending the framework instead of modifying its core whenever possible.

This document defines every supported extension type and its responsibilities.

---

# Philosophy

Before adding functionality to the framework, ask:

> Can this be implemented as an extension?

If the answer is yes, it should not be part of the kernel.

The kernel exists to orchestrate the compilation process.

Extensions provide capabilities.

---

# Extension Types

The framework currently defines six extension types.

```
Builder
        │
        ▼

Compiler Plugin
        │
        ▼

Runtime Emitter
        │
        ▼

Runtime Plugin
        │
        ▼

Generator
        │
        ▼

CLI Command
```

Each extension has a distinct responsibility.

Responsibilities should never overlap.

---

# Builders

Builders extend the framework's DSL.

They allow applications to describe new concepts without introducing runtime behavior.

Examples:

```ts
bucket("uploads")

queue("emails")

schedule("daily")
```

Builders do not execute logic.

They produce semantic metadata consumed during compilation.

Builders should:

- be pure;
- be immutable;
- produce deterministic output;
- avoid side effects.

Builders belong to the compile-time model.

---

# Compiler Plugins

Compiler plugins consume the semantic graph.

Their responsibility is to transform semantic information into artifacts.

Typical outputs include:

- runtime code
- OpenAPI specifications
- CloudFormation templates
- SDKs
- documentation
- deployment manifests
- generated tests

Compiler plugins execute only during compilation.

They are removed from the final application.

Compiler plugins should normally be installed as development dependencies.

## Runtime Emitters

Runtime emitters generate platform-native runtime source from merged descriptors.

They should:

- translate descriptors into executable source;
- preserve tree-shaking opportunities;
- keep platform-specific logic out of the core;
- disappear after compilation.

Runtime emitters should not inspect source files or construct the semantic graph.

If a platform needs runtime bridging, keep that bridge separate from the emitter. It should only adapt platform I/O to the core execution context and serialize the core result back to the platform.

---

# Runtime Plugins

Runtime plugins provide executable behavior.

Unlike compiler plugins, they remain part of the final application.

Examples:

- logging
- authentication
- authorization
- validation
- metrics
- middleware
- filters
- serialization

Runtime plugins should remain:

- composable;
- independently testable;
- tree-shakable;
- provider independent whenever possible.

---

# Generators

Generators create project source code.

They are executed through the framework CLI.

Unlike compiler plugins, generators do not consume the semantic graph.

Instead, they scaffold new files following the project's architectural conventions.

Examples:

```
framework make controller UserController

framework make service UserService

framework make resource User

framework make plugin aws
```

Generators should generate code that follows the current project conventions.

Generated code should be production-ready.

---

# CLI Commands

CLI commands extend the framework tooling.

They automate developer workflows.

Examples:

```
framework build

framework validate

framework graph

framework doctor

framework clean
```

CLI commands may:

- inspect projects;
- execute compiler pipelines;
- invoke generators;
- perform diagnostics;
- validate configuration.

The CLI is part of the development and compile-time experience.

It is never shipped with production applications.

---

# Choosing the Right Extension

Use this decision guide before implementing new functionality.

| Goal | Extension |
|-------|-----------|
| Add a new DSL primitive | Builder |
| Generate infrastructure or documentation | Compiler Plugin |
| Execute application behavior | Runtime Plugin |
| Scaffold project files | Generator |
| Add developer tooling | CLI Command |

---

# Responsibilities

Each extension should own exactly one concern.

Avoid combining multiple responsibilities into the same extension.

For example:

A generator should not generate CloudFormation.

A compiler plugin should not scaffold controllers.

A runtime plugin should not modify source code.

Keeping responsibilities isolated improves maintainability and enables independent evolution.

---

# Package Organization

The repository separates extensions from the framework kernel.

```
packages/
    compiler/
    core/
    cli/

plugins/
    aws/
    openapi/
    cloudformation/

runtime/
    logger/
    validation/
    auth/

generators/
    controller/
    service/
    resource/

commands/
    doctor/
    graph/
    clean/
```

Every extension should be independently testable and versionable.

Dependencies between extensions should be minimized.

---

# Design Principles

Every extension should:

- have a single responsibility;
- expose a small public API;
- avoid global mutable state;
- be deterministic;
- integrate through documented extension points;
- respect the compile-time first architecture.

Whenever possible, extensions should compose instead of replacing existing behavior.

---

# Guiding Principle

Keep the kernel small.

Move capabilities into extensions.

Allow applications to opt into functionality instead of paying for features they do not use.
