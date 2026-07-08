# Plugin System

The framework executes in three distinct phases.

Each phase has different responsibilities, different constraints and different APIs.

Understanding these phases is essential when extending the framework.

---

# Overview

```
Development

↓

Compile

↓

Runtime
```

Every package, builder and plugin should clearly belong to one or more of these phases.

Mixing responsibilities between phases should be avoided.

---

# Development Time

Development time is everything that happens while writing the application.

This includes:

- IDE support
- TypeScript type checking
- ESLint
- Auto-completion
- Code generation
- CLI commands
- Project scaffolding

The primary goal during this phase is developer experience.

Framework APIs should be:

- strongly typed;
- predictable;
- discoverable;
- easy to compose.

Errors should be caught as early as possible.

---

# Compile Time

Compilation transforms semantic information into executable artifacts.

During this phase the framework:

- collects metadata
- builds the semantic registry
- validates declarations
- constructs the semantic graph
- executes compiler plugins
- generates artifacts

Nothing produced during this phase should be required at runtime unless explicitly intended.

Compiler plugins are responsible for tasks such as:

- OpenAPI generation
- CloudFormation generation
- SDK generation
- Documentation
- Code generation
- Static validation

The CLI also executes compile-time commands.

Examples:

```
framework build

framework openapi

framework docs

framework doctor

framework graph

framework validate
```

The CLI is considered part of the compiler.

It is never shipped with production code.

---

# Runtime

Runtime begins after compilation.

Everything related to compilation is discarded.

This includes:

- CLI
- compiler
- semantic registry
- compiler plugins
- graph builders
- code generators

Only executable application code remains.

Runtime components may include:

- middleware
- filters
- validation
- logging
- authentication
- authorization
- serialization
- HTTP adapters
- helper utilities

Runtime should contain only code necessary to execute the application.

---

# Compiler Plugins

Compiler plugins execute only during compilation.

Their responsibility is to consume the semantic graph and generate artifacts.

Compiler plugins must never introduce runtime dependencies unless explicitly generating runtime code.

Typical examples:

- AWS
- CloudFormation
- OpenAPI
- Documentation
- SDK
- Tests

Compiler plugins should normally be development dependencies.

---

# Runtime Plugins

Runtime plugins provide executable behavior.

Unlike compiler plugins, they remain part of the final application.

Examples include:

- Logger
- Validation
- Authentication
- Metrics
- Retry
- Cache

These plugins should remain small, composable and independently tree-shakable.

---

# The CLI

The CLI is the primary interface for interacting with the compiler.

It is responsible for:

- project scaffolding;
- code generation;
- validation;
- build orchestration;
- plugin execution;
- diagnostics.

The CLI should feel similar to tools such as:

- Laravel Artisan
- Symfony Console
- Angular CLI
- Nest CLI

The difference is that every command ultimately operates on the semantic graph.

Examples:

```
framework new my-app

framework generate controller User

framework generate service User

framework generate resource User

framework generate plugin aws

framework build

framework graph

framework doctor

framework validate

framework clean
```

Commands should be composable and provider-independent whenever possible.

---

# Responsibilities

| Phase | Owns |
|--------|------|
| Development | Developer experience |
| Compile | Analysis, validation and artifact generation |
| Runtime | Application execution |

Each concern should exist in exactly one phase.

---

# Guiding Principle

Development improves the developer.

Compilation builds the application.

Runtime executes only what could not be eliminated.
