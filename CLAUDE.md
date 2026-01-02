# Working Guide
- After adding any code or functionality, write thorough unit tests and check coverage.
- After making any changes always execute `pnpm format && pnpm build && pnpm test` to verify
- Fix any pnpm format issues (even if they are unrelated)
- Never edit files in lib/db/migrations/ - instead run drizzle `pnpm db:generate` to create migrations

# Practical Principles
- One file = one purpose (no 800-line “service.ts”).
- No “utils” without a namespace (e.g., shared/transport/httpErrors.ts, not utils.ts).
- Explicit exports per module (modules/users/index.ts) to prevent random deep imports.
- Import rules (ESLint + boundaries):
  - Domain cannot import from infrastructure or transport
  - Transport cannot import other module’s infrastructure directly, only application exports
  - Transaction ownership lives in application layer (not in route handlers).

# Architecture

## Goals
- Domain/service code depends only on interfaces
- Easy to swap implementations (test doubles, different providers)
- Explicit contracts at boundaries
- No business rules in services.
- Map domain errors → HTTP errors at API layer
- Keeping Next.js at the edge
- Centralize boundary validation + error mapping. Add zod DTOs for all HTTP entrypoints.

## Layers
- Separate **layers**. 
  - HTTP API e.g. routing and middleware
  - Application / use-cases / services / orchestration
  - Domain entities and pure business logic
  - Infrastructure e.g. DB, message queues, external APIs.
- Separate “what we do” from “how we talk to the world”. Business rules should not know about HTTP, Next.js, headers, DB query builders, etc.
- Dependency direction is one-way
  - `transport (HTTP/webhook) → application → domain → (ports) → infrastructure`
  - Infrastructure can depend on domain/application; domain never depends on infrastructure.

## Implementations
- Make side effects explicit. DB writes, network calls, queues, emails, payments: wrap behind interfaces (“ports”) and inject.
- Keep domain types stable and meaningful. Use real types (`User`, `Event`, `Message`) and parse/validate at the edges. Validate at the boundaries, normalize once.
- Errors are part of the design. Use a consistent error model: domain errors vs system errors; map to HTTP/status/logging in one place.
- Observability is a feature. Structured logs, request IDs, event IDs for webhooks, metrics around critical flows.

# TypeScript
- **Type everything**: params, returns, config objects, and external integrations; avoid `any` 
- **Use interfaces**: for complex types and objects, including ports and DTOs
- **Use namespaces**: for organizing related types and functions
- **Make Illegal States Unrepresentable**: If something should never happen, encode that rule in the type system instead of comments or runtime checks.
  - Discriminated unions instead of flags + nullable fields
  - Branded domain types instead of primitives
  - Narrowed constructors / factory functions
- **Avoid Type Assertions (as)**: Every as is a potential runtime crash hidden from the compiler.
  - Replace with: Narrowing functions or Exhaustive pattern matching or Refined input types
- **Prefer Union Types Over Boolean Flags**: Boolean flags destroy invariants.
- **Separate Pure Logic from Side Effects**: Functions that return void hide meaning from the compiler.
  - Prefer Pure functions with explicit inputs/outputs.

# Cross-cutting backend concerns

- **Error handling**: Throw domain/application errors (e.g. `DomainError`, `NotFoundError`), then map them to HTTP responses in a global error handler.
- **Configuration**: Expose a typed `config` module; never access `process.env` all over the codebase.
- **Testing**: Unit-test domain/services in isolation using in-memory mocks of ports; integration-test adapters (DB, external APIs) and a few end-to-end flows.
