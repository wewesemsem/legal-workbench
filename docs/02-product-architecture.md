# Product Architecture

The product is divided into six major layers. Phase 1 implements foundations under Workbench, Data/Persistence, and Security. Later phases fill in Orchestrator, Agents, Model Gateway, Tool Layer, and advanced Memory.

```text
┌─────────────────────────────────────────────────────────────┐
│                    LAWYER WORKBENCH                        │
│                                                             │
│  Chat │ Research │ Documents │ Drafting │ Cases │ Clients  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                       AI ORCHESTRATOR                       │
│                                                             │
│ Planning │ Agent routing │ Context │ Memory │ HITL          │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┼────────────────────────┐
       │                       │                        │
       ▼                       ▼                        ▼
┌──────────────┐       ┌───────────────┐       ┌──────────────┐
│ Multi-Agent  │       │ Multi-Model   │       │ Tool Layer   │
│ System       │       │ Gateway       │       │              │
│              │       │               │       │ Web          │
│ Research     │       │ OpenAI        │       │ Files        │
│ Document     │       │ Anthropic     │       │ Code         │
│ Drafting     │       │ Google        │       │ APIs         │
│ Review       │       │ Open models   │       │ Legal DB     │
└──────────────┘       └───────────────┘       └──────────────┘
       │                       │                        │
       └───────────────────────┼────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE / MEMORY                       │
│                                                             │
│ Legal Corpus │ Matter Context │ Short-term │ Long-term     │
│ User Context │ Conversation   │ Workspace   │ Feedback      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                   DATA / PERSISTENCE                        │
│                                                             │
│ PostgreSQL │ Object Storage │ Vector Search │ Audit Logs    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                SECURITY / ISOLATION                         │
│                                                             │
│ Tenant Isolation │ IAM │ Encryption │ Sandbox │ DLP         │
│ Rate Limits │ Audit │ Secrets │ Monitoring                  │
└─────────────────────────────────────────────────────────────┘
```

## Layer responsibilities

### 1. Legal Workbench

User-facing product surface: chat, research, documents, drafting, cases/matters, clients, settings.

Phase 1 focuses on: auth, workspaces, matters, clients, documents, chat, basic research via RAG, citations.

### 2. AI Orchestrator

Plans work, routes to agents, loads context, manages memory boundaries, and applies human-in-the-loop gates.

Phase 1: a thin request path (context load → retrieve → LLM → validate citations → respond). Full planner/agent routing is Phase 2.

### 3. Multi-Agent / Multi-Model / Tool Layer

Specialized agents, provider-agnostic model access, and tools (files, APIs, legal DB, later code/web).

Phase 1: single chat path + legal retrieval tools. Provider interface exists so agents/gateway can be added later without rewrite.

### 4. Knowledge / Memory

Separates public legal knowledge from customer matter context and conversation/user preferences.

Phase 1: legal corpus + matter-scoped chat/documents. Long-term preference memory is minimal.

### 5. Data / Persistence

PostgreSQL (including pgvector), object storage for files, audit logs.

Phase 1: no separate vector database.

### 6. Security / Isolation

Tenant isolation, IAM/RBAC, encryption in transit, secrets, rate limits, audit, later sandbox/DLP/monitoring depth.

Phase 1: authn/z, workspace + matter isolation, secure file access, validation, rate limits, audit logging, basic prompt-injection defenses.

## Engineering stance

- Prefer a **modular monolith** until clear scale/isolation needs justify extraction.
- Do not introduce microservices because the eventual diagram shows separate boxes.
- Keep clean module boundaries so Orchestrator/Agents/Gateway can be added without rewriting Workbench or Persistence.
- Infrastructure topology (CDN, WAF, dedicated environments) comes later; application architecture first.
