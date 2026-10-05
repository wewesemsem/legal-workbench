# Documentation Index

This folder is the source of truth for product vision and architecture. Implementation must follow these docs, especially Phase 1 constraints.

## How to use these docs

1. Read [01-product-concept.md](01-product-concept.md) for the product thesis.
2. Read [02-product-architecture.md](02-product-architecture.md) for the long-term product shape.
3. Read [09-roadmap.md](09-roadmap.md) to know what is in/out of each phase.
4. Read [10-phase-1-plan.md](10-phase-1-plan.md) and [11-tech-stack.md](11-tech-stack.md) before writing code.

## Principles that override local convenience

- Do not overengineer Phase 1.
- Prefer a modular monolith initially.
- Country is first-class; Egypt is the first dataset, not a hardcoded product.
- Legal corpus is separate from customer data.
- Matter context must never leak across matters or tenants.
- Citations must come from stored provenance, never invented by the model.
- Advanced multi-agent / infrastructure systems are Phase 2+ unless required for foundation.

## Document map

| File | Purpose |
|---|---|
| `01-product-concept.md` | Working description, thesis, country model |
| `02-product-architecture.md` | Six major product layers |
| `03-ai-system.md` | Agentic control loop, agents, gateway, memory, HITL, sandbox |
| `04-privacy-security.md` | Isolation and security requirements |
| `05-legal-corpus.md` | Legal DB, chunking, RAG, provenance |
| `06-ux-roles-language.md` | Lawyer vs client UX; UI vs legal-source language |
| `07-business-model.md` | Free / Pro / Enterprise |
| `08-evaluation-learning.md` | Feedback loop and evaluation architecture |
| `09-roadmap.md` | Phase 1–4 roadmap |
| `10-phase-1-plan.md` | Implementation order and definition of done |
| `11-tech-stack.md` | Stack, API style, configuration |
