# Phase 1 Implementation Plan

**Status:** Step 1 (Auth) + Documents/Document AI foundation implemented (includes minimal Workspaces/Matters for document scoping).

**Repository state:** Greenfield (empty). No existing app to extend.

## Definition of Done

A lawyer can:

```text
Sign up
 → Log in
 → Create/enter a Workspace
 → Create a Matter
 → Add a Client
 → Upload a Document
 → Open Matter Chat
 → Ask an ordinary AI question
 → Ask a legal question
 → RAG retrieves Egyptian legal sources
 → AI generates grounded response
 → Citations are displayed
 → Lawyer can inspect the cited source
```

And the system guarantees:

```text
User A        ✕ cannot access User B's workspace
Workspace A   ✕ cannot access Workspace B
Matter A      ✕ cannot access Matter B
Customer docs ✕ do not automatically enter the public legal corpus
```

## Out of scope for Phase 1

- Full multi-agent orchestration
- Multi-provider model gateway routing
- Document AI / OCR pipelines
- Drafting / review agents
- Code-execution sandbox
- Full client portal polish
- Billing / Pro entitlements enforcement
- Commercial legal databases
- Multi-country production corpora (schema support only; EG seed data)
- Enterprise SSO / dedicated environments

## Build order

### Step 0 — Project foundation

- Initialize git and Next.js TypeScript app
- Docker Compose: PostgreSQL + pgvector, MinIO
- Drizzle schema package / folder, migrations, env example
- Module boundaries and shared config
- Health check + baseline lint/test setup

### Step 1 — Auth + users + roles

- Sign up / login / logout / session
- Roles: `lawyer`, `client`
- Password hashing, secure cookies
- Rate limiting on auth endpoints

### Step 2 — Workspaces (tenant boundary)

- Create / list / enter workspace
- `workspace_members`
- All queries scoped by membership
- Audit log skeleton

### Step 3 — Matters + clients

- Matter CRUD inside workspace
- Attach client(s) with explicit grants
- Matter-level ACL
- Fields/flags for shared vs internal content

### Step 4 — Documents

- Upload associated with matter
- Metadata: workspace, matter, uploader, filename, type, size, storage location, status, timestamps
- Authorized download path
- Basic statuses (`uploaded` → `stored`)
- Support PDF, DOCX, images, text at storage level (no advanced intelligence)

### Step 5 — Matter-aware chat

- Chat + messages belong to a matter
- Ordinary AI conversation with matter metadata context
- No global all-documents context
- Basic prompt-injection defenses

### Step 6 — Egyptian legal corpus

- Country-aware `legal_documents` / `legal_chunks`
- Curated public EG seed + ingest script
- Provenance required (source name/URL/checksum)

### Step 7 — Basic RAG + citations

- Structure-aware chunking where possible
- Embeddings into pgvector
- Hybrid retrieval (full-text + vector)
- Grounded answer behavior + insufficient-evidence refusal
- Citation UI from stored metadata

### Step 8 — Security hardening pass

- End-to-end RBAC checks
- Isolation regression tests
- File validation
- API validation / rate limits / audit events
- Confirm corpus/customer separation

### Step 9 — DoD walkthrough

- Full lawyer path demo
- Isolation tests green

## Validation after each major step

1. Run tests
2. Check regressions
3. Validate migrations
4. Validate authorization
5. Validate API behavior
6. Validate frontend behavior for completed UI surfaces

## Risks

| Risk | Mitigation |
|---|---|
| Empty repo / stack lock-in | Agree stack in `11-tech-stack.md` before coding |
| EG primary-source access limits | Curated seed first; lawful ingest only |
| Arabic retrieval quality | Multilingual embeddings from day one |
| Scope creep into Phase 2 agents | Keep thin control loop; document future seams only |
