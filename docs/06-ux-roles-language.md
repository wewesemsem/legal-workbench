# UX, Roles & Language

## 1. Separate lawyer and client experiences

Interfaces should be separated conceptually from the start.

### Lawyer workbench

```text
Dashboard
├── Matters
├── Research
├── Documents
├── Drafts
├── AI Agents
├── Clients
└── Settings
```

Lawyer capabilities (eventual):

- create/manage matters
- upload documents
- conduct legal research
- chat with AI
- draft documents
- review documents
- invite clients
- manage workspace information

### Client portal

```text
Client Portal
├── Matter
├── Documents
├── Messages
├── Tasks
├── Status
└── Approvals
```

Client capabilities (eventual):

- access authorized matter(s)
- upload documents
- view documents shared with them
- communicate with their lawyer
- complete requested tasks
- view approved information

Clients should not automatically see the lawyer’s internal research, notes, reasoning, drafts, or other matters.

### Phase 1 UX scope

- Lawyer-first UI for the full Phase 1 flow
- Client role and authorization model present in the backend
- Minimal client-facing access is acceptable; full portal polish is Phase 3

## 2. Language model

Language is architectural, not cosmetic.

```text
Language
├── Arabic
├── English
└── Eventually other regional languages
```

Critical distinction:

```text
UI language ≠ legal-source language
```

Example:

- English UI
- researching Arabic Egyptian legislation
- English explanation + Arabic primary-source citation

Phase 1 should establish:

- language fields on users/preferences and legal documents
- bilingual response patterns for grounded legal answers
- Arabic primary text as authoritative source text in citations
