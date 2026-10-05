# Tech Stack (Phase 1)

Agreed direction for the greenfield build. Change only deliberately before Step 0 scaffolding.

## Stack

| Layer | Choice |
|---|---|
| App | **Next.js (App Router) + TypeScript** modular monolith |
| UI | React + Tailwind CSS |
| API | **Next.js Route Handlers** (`app/api/...`), REST-style JSON |
| Validation | Zod |
| Auth | Better Auth (email/password + sessions) |
| Database | PostgreSQL + **pgvector** |
| ORM / migrations | Drizzle ORM |
| Object storage | S3-compatible (MinIO in local dev) |
| LLM | OpenAI (behind provider interface) |
| Embeddings | Multilingual embedding model via provider interface |

## API conventions

- REST-style JSON endpoints under `/api/...`
- Examples:
  - `POST /api/auth/sign-up`
  - `GET /api/workspaces`
  - `POST /api/workspaces/:workspaceId/matters`
  - `POST /api/matters/:matterId/documents`
  - `POST /api/matters/:matterId/chats/:chatId/messages`
- Zod validation on every request body/query
- Session auth on protected routes
- Authorization in service/data-access layer (workspace + matter checks)
- No GraphQL and no separate microservice API in Phase 1

## Proposed module boundaries

```text
modules/
  auth/
  users/
  workspaces/
  matters/
  clients/
  documents/
  chat/
  legal-corpus/
  rag/
  llm/
```

Clean interfaces between modules. Legal corpus remains separate from customer document modules.

## Configuration

Never hard-code:

- API keys
- passwords
- database credentials
- model credentials
- secret keys

Use environment variables and `.env.example` documentation.

## Local infrastructure

Docker Compose services for Phase 1 development:

- PostgreSQL with pgvector
- MinIO (S3-compatible)

## Explicit non-goals for Phase 1 stack

- Separate vector database
- Microservices
- Multi-provider production routing
- Agent runtime / sandbox cluster
- Commercial legal DB SDKs

## Open decisions (confirm before coding if needed)

1. Auth library: Better Auth (current recommendation) vs Auth.js vs Clerk
2. Repo layout: single Next.js app with internal modules (lean default) vs `apps/web` + `packages/db` monorepo
3. Corpus seed: curated EG public materials first (recommended)
