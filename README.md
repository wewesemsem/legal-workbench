# Legal Workbench

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

## Deploy (Railway staging)

Staging/demo target for you and a few testers. Uses a long-running Node process (agent runs can exceed serverless timeouts), Railway Postgres with pgvector, and a volume for document files.

### 1. Create the project

```bash
# Install CLI if needed: https://docs.railway.com/guides/cli
railway login
railway init   # or: railway link
```

Connect the GitHub repo in the Railway dashboard, or deploy from this directory:

```bash
railway up
```

[`railway.toml`](railway.toml) sets `npm run build`, `npm start`, and runs `npm run db:migrate` as a pre-deploy step.

### 2. Add Postgres (pgvector)

1. In the Railway project: **New → Database → PostgreSQL**.
2. On the web service, set `DATABASE_URL` to the Postgres variable reference (e.g. `${{Postgres.DATABASE_URL}}`).
3. Confirm the extension works (Railway Postgres supports it; migrations also run `CREATE EXTENSION IF NOT EXISTS vector`):

```bash
railway connect Postgres
# then: CREATE EXTENSION IF NOT EXISTS vector;
```

If the managed addon lacks `vector`, add a Docker service from `pgvector/pgvector:pg16` instead and point `DATABASE_URL` at that instance.

### 3. Persistent file storage

1. Web service → **Settings → Volumes** → mount path `/data/storage`.
2. Set:

```bash
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=/data/storage
```

Do not use the default local `.data/storage` path on Railway — it is not durable across deploys.

### 4. Required environment variables

Copy from [`.env.railway.example`](.env.railway.example). Minimum:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Railway Postgres URL / reference |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public HTTPS URL (after generating a domain) |
| `NEXT_PUBLIC_APP_URL` | Same public HTTPS URL |
| `STORAGE_PROVIDER` | `local` |
| `LOCAL_STORAGE_PATH` | `/data/storage` |

Demo-safe defaults (already fine for staging):

- `DOCUMENT_AI_PROVIDER=mock`
- `LLM_PROVIDER=mock`
- `LEGAL_EMBEDDING_PROVIDER=mock`
- `EMAIL_PROVIDER=console`
- `LEGAL_CORPUS_MODE=fixture`

Generate a public domain: web service → **Settings → Networking → Generate Domain**, then set both auth/app URL vars to that `https://….up.railway.app` value.

### 5. Migrate + smoke test

Migrations run automatically via `preDeployCommand` in [`railway.toml`](railway.toml). To run manually:

```bash
railway run npm run db:migrate
```

Then verify:

1. Open the public URL → register / login
2. Create a matter → upload a small PDF
3. Start a mock agent run
4. Redeploy or restart → confirm the uploaded file is still available (volume persistence)

### Optional live AI / email

Same deploy; flip variables on the web service:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
LEGAL_EMBEDDING_PROVIDER=openai
# then one-off: railway run npm run corpus -- index

WEB_SEARCH_PROVIDER=brave
BRAVE_SEARCH_API_KEY=...

EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=Legal Workbench <noreply@your-domain.com>
```

### When you outgrow staging

Move to **Vercel Pro + Neon (pgvector) + Cloudflare R2 + Resend** for private beta with versioned object storage and stronger backup/uptime controls.

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
