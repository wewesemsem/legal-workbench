# Privacy & Security Architecture

Privacy is part of the architecture, not an add-on.

## 1. Tenant isolation (workspace boundary)

Treat each workspace as a tenant boundary.

```text
Firm / Workspace A
  ├── Lawyer 1
  ├── Lawyer 2
  ├── Client A
  ├── Matter A
  └── Matter B

Firm / Workspace B
  ├── Lawyer 3
  ├── Client B
  └── Matter C
```

Rules:

- No cross-tenant retrieval
- Data from Workspace A must never be accessible from Workspace B
- Authorization checks live in the backend/data-access layer, not only the frontend

## 2. Matter isolation

Even inside one firm/workspace:

```text
Lawyer
│
├── Matter A → Data A
├── Matter B → Data B
└── Matter C → Data C
```

Rules:

- Matter A confidential documents must not enter Matter B AI context
- Chat, documents, research, and drafts are matter-scoped
- Retrieval queries must include matter/workspace authorization constraints

## 3. Lawyer vs client visibility

Clients must **not** automatically have access to:

- lawyer internal notes
- internal research
- internal AI context
- other matters
- other clients
- internal drafts unless explicitly shared

Clients may eventually:

- access authorized matters
- upload documents
- view shared documents
- communicate with their lawyer
- complete requested tasks
- view approved information

Build authorization so these boundaries exist from the beginning, even if the client portal UI is limited in Phase 1.

## 4. Customer data vs legal corpus

```text
LEGAL CORPUS          CUSTOMER DATA
─────────────         ─────────────
Laws                  Workspaces
Regulations           Matters
Decisions             Client Documents
Court materials       Chats
Legislative materials Drafts
```

Customer documents must **not** automatically become part of the global legal corpus.

## 5. Phase 1 security foundation

Minimum controls:

- Authentication
- Authorization
- Role-based access control (lawyer / client at minimum)
- Workspace isolation
- Matter-level access control
- Secure document access (no public unauthenticated object URLs)
- Encryption in transit (TLS)
- Secure secret management (environment variables / secret store; never hard-code)
- API validation
- Rate limiting
- Audit logging
- Basic prompt-injection defenses
- Secure file handling (type/size checks, malware-aware posture later)

Never expose another user's:

- matter
- documents
- messages
- client information
- AI context
- workspace data

## 6. Future security depth (not Phase 1 complete)

- Agent sandbox with narrowly scoped credentials
- DLP controls
- Dedicated environments / data residency
- SSO and enterprise RBAC
- Penetration testing and advanced monitoring

See [09-roadmap.md](09-roadmap.md) for phase placement.
