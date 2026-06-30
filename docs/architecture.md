# Architecture

AI Interviewer is organized as an npm workspace monorepo. Each application owns its runtime concerns, while the `shared` package contains stable cross-boundary contracts.

## Boundaries

- `frontend`: React UI, route-level pages, presentational components, and API client code.
- `backend`: Express server, HTTP middleware, feature modules, infrastructure configuration, and database integration points.
- `shared`: types, constants, and schemas that must remain consistent across frontend and backend.
- `docs`: architectural decisions, setup notes, and future operating guidance.

## Feature Organization

Backend functionality should be added under `backend/src/features/<feature-name>`. Each feature can own its routes, service logic, validation, and tests. Shared middleware and infrastructure belong outside feature folders.

Frontend functionality should be added under `frontend/src/pages` for route-level screens and `frontend/src/components` for reusable UI. As product areas grow, introduce `frontend/src/features/<feature-name>` rather than flattening all logic into global folders.

## Database

PostgreSQL is the intended persistence layer. This foundation only defines the environment contract. Add migrations and a data access layer when the first persisted product capability is introduced.

## Principles

- Keep contracts explicit and typed.
- Prefer feature ownership over global buckets.
- Avoid premature abstractions.
- Treat authentication, persistence, and AI orchestration as separate concerns.
- Keep backend routes thin and push business logic into feature services.
