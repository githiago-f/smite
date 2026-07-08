# Smite

> **Write intent. Compile reality. Ship only what executes.**

Smite is a compile-time-first TypeScript framework built around a semantic compiler.

Applications describe intent through a functional DSL. During compilation, Smite generates runtime code, infrastructure, documentation and other production artifacts while minimizing runtime overhead.

## Why?

Modern backend frameworks often require developers to maintain the same information in multiple places:

- HTTP routes
- OpenAPI specifications
- Infrastructure definitions
- SDKs
- IAM policies
- Documentation
- Deployment manifests

Keeping these artifacts synchronized is difficult and error-prone.

This framework solves that problem by allowing developers to describe their application once. Everything else is generated during compilation.

## Core Principles

- **Compile-Time First** — compilation is the primary execution model.
- **Functional DSL** — builders describe intent, never execution.
- **Semantic Graph** — every artifact is generated from a single source of truth.
- **Zero-Cost Runtime** — abstractions should disappear after compilation.
- **Provider Agnostic** — business logic should remain independent from cloud providers.
- **Plugin Driven** — capabilities are implemented as compiler or runtime plugins.

## How It Works

```text
Application

↓

Functional DSL

↓

Semantic Registry

↓

Semantic Graph

↓

Compiler Pipeline

↓

Compiler Plugins

↓

Generated Artifacts

↓

Production Runtime
```

During compilation the framework collects semantic information, validates it, builds a semantic graph and executes compiler plugins.

The generated output becomes the production application.

The framework itself should contribute as little runtime code as possible.

## Monorepo

This project uses **Yarn Workspaces**.

The repository is organized into independent packages with clear responsibilities.

```text
.
├── packages/
│   ├── compiler/
│   ├── core/
│   ├── builders/
│   ├── registry/
│   └── graph/
│
├── plugins/
│   ├── aws/
│   ├── openapi/
│   ├── cloudformation/
│   └── ...
│
├── runtime/
│
├── docs/
│
├── skills/
│
└── examples/
```

Each workspace should have a single responsibility and expose a small, stable public API.

## Example

The application describes requirements instead of implementation.

```ts
const app = application({
  routes: [
    route({
      method: "GET",
      path: "/users",
      handler: getUsers,
    }),
  ],
});
```

The compiler may generate:

- Runtime handlers
- OpenAPI specification
- CloudFormation templates
- SDKs
- Documentation
- Tests
- Deployment artifacts

without requiring those definitions to be written manually.

## Documentation

Documentation is intentionally layered.

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview and quick start |
| `AGENTS.md` | Entry point for AI agents and contributors |
| `docs/architecture.md` | Core architectural principles |
| `docs/harness.md` | Engineering heuristics |
| `docs/plugin-system.md` | Plugin architecture |
| `skills/` | Specialized implementation knowledge |

Each document builds upon the previous one to avoid duplicated information.

## Project Status

The framework is currently under active design and development.

The architecture is being defined before implementation to ensure consistency, extensibility and long-term maintainability.

Contributions are welcome once the core architecture and plugin model are stabilized.

## License

MIT
