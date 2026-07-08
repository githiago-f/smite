# Smite

> **Write intent. Compile reality. Ship only what executes.**

Smite is a compile-time-first TypeScript framework built around a semantic compiler.

Applications describe intent through a functional DSL. During compilation, Smite generates runtime code, infrastructure, documentation and other production artifacts while minimizing runtime overhead.
Runtime emitters turn descriptors into platform-native source, such as an Express app module, before the final bundle is produced. Runtime adapters like `@smitejs/runtime-express` bridge Express requests and responses to the execution model owned by the core.

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
- **Plugin Driven** — capabilities are implemented as compiler plugins, runtime emitters or runtime plugins.

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

Runtime Emitters

↓

Generated Artifacts

↓

Production Runtime
```

During compilation the framework collects semantic information, validates it, builds a semantic graph and executes compiler plugins and runtime emitters.

The generated output becomes the production application.

The framework itself should contribute as little runtime code as possible.
The first runtime emitter prototype in this repository is `@smitejs/runtime-express`, which targets Express and consumes the core HTTP execution pipeline.

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
├── plugins/
│   ├── aws/
│   ├── openapi/
│   ├── cloudformation/
│   └── ...
├── runtime/
├── .docs/
├── skills/
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

The main project documentation is published at:

**https://githiago-f.github.io/smite/smitejs-core/**

The published documentation is generated from JSDoc comments and tested snippets
that live in the codebase.

JSDoc entries and concept pages reference examples with `@example`. Each example
must match a snippet declared inside a test file between `#section` and
`#endsection`, so documentation examples are always executed by the test suite.

Contributor documentation remains intentionally layered.

| Document | Purpose |
|----------|---------|
| Published docs | Main API documentation and tested usage examples |
| `README.md` | Project overview |
| `AGENTS.md` | Entry point for AI agents and contributors |
| `.docs/architecture.md` | Core architectural principles |
| `.docs/harness.md` | Engineering heuristics |
| `.docs/plugin-system.md` | Plugin architecture |
| `.agents/skills/` | Specialized implementation knowledge |

Each document builds upon the previous one to avoid duplicated information.

## npm Releases

Publishable packages are released to npm from Git tags.

Release tags must use SemVer with a `v` prefix:

```sh
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions validates that every publishable workspace version matches the
tag before publishing. The npm workflow requires an `NPM_TOKEN` repository secret
with publish access.

## Project Status

The framework is currently under active design and development.

The architecture is being defined before implementation to ensure consistency, extensibility and long-term maintainability.

Contributions are welcome once the core architecture and plugin model are stabilized.

## License

MIT
