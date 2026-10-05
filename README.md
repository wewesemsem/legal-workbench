# Lawyer Workbench

AI-native legal workbench for Middle East lawyers — starting with Egypt.

## Current status

Foundation complete through **Documents + Document AI**, **legal corpus retrieval**, **web research**, and **Phase 4 AI Legal Agents** (orchestrator + specialized agents with tool permissions and human approval).

## Quick start

```bash
# 1. Start Postgres (pgvector image; host port 55432)
docker compose up -d

# 2. Configure env
cp .env.example .env
# set BETTER_AUTH_SECRET (openssl rand -base64 32)

# 3. Apply migrations
npm run db:migrate

# 4. Run the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js |
| `npm test` | Run auth/authorization/security tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations |

## Auth API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET|POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`
- `POST /api/auth/change-password`

Roles: `LAWYER`, `CLIENT`.

Password rules: min 8 chars, upper, lower, number, special character.

Email: default `EMAIL_PROVIDER=console` logs messages locally. Set `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` for real delivery.

Documents: upload PDF/images or multi-page photos inside a Matter. Default `DOCUMENT_AI_PROVIDER=mock` for local OCR; set `google` + GCP processor env vars for Document AI.

## AI Agents API

- `POST /api/agents/run` — start an orchestrated (or direct) agent run for a matter
- `GET /api/agents/runs/:runId` — run status, steps, result (no chain-of-thought)
- `GET /api/matters/:matterId/agents` — list runs + pending approvals
- `GET|POST /api/agents/approvals/:approvalId` — review / approve / edit / reject

Agents: Research, Document, Drafting, Review — coordinated by an Orchestrator with:
- structured AI planner + deterministic fallback
- dynamic allowlisted tool-calling control loop
- Matter RAG (pgvector hybrid retrieval, separate from legal corpus)
- server-side plan/tool permissions and human approval for drafts

```bash
# Live agent QA script (uses mock providers)
NODE_ENV=test LLM_PROVIDER=mock LEGAL_EMBEDDING_PROVIDER=mock WEB_SEARCH_PROVIDER=mock \
  npx tsx scripts/browser-qa-agents.ts
```

## Documentation

See [`docs/00-index.md`](docs/00-index.md) for product architecture and Phase 1 plan.
