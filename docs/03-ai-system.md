# AI System Architecture

This document describes the long-term AI architecture. Phase 1 implements a thin, grounded version of the control loop. Full multi-agent orchestration is Phase 2.

## 1. Control loop

The AI system is modeled as a control loop, not a bare “call LLM from chat endpoint” design.

```text
                 ┌──────────────┐
                 │ User Request │
                 └──────┬───────┘
                        ▼
                ┌───────────────┐
                │ Context Load  │
                └──────┬────────┘
                       ▼
                ┌───────────────┐
                │   Planner     │
                └──────┬────────┘
                       ▼
                ┌───────────────┐
                │ Think / Decide│
                └──────┬────────┘
                       ▼
                ┌───────────────┐
                │ Execute Tool  │
                └──────┬────────┘
                       ▼
                ┌───────────────┐
                │    Observe    │
                └──────┬────────┘
                       │
              ┌────────┴─────────┐
              │                  │
         Need more work?       Finished?
              │                  │
              ▼                  ▼
            Loop              Validate
                                 │
                                 ▼
                              Response
```

### Phase 1 instantiation

```text
User Request
  → Load matter + conversation context (scoped)
  → Retrieve legal passages (hybrid RAG) when legal question
  → Call LLM with grounded prompt
  → Validate citations against retrieved metadata
  → Respond (or refuse if insufficient evidence)
```

No multi-step planner/agent swarm in Phase 1.

## 2. Multi-agent system

Avoid creating many agents initially. Target five core agents in Phase 2:

| Agent | Responsibility |
|---|---|
| **Orchestrator** | Which agent, order, models/tools; HITL gates |
| **Research Agent** | Laws, regulations, court decisions, principles, sources |
| **Document Agent** | OCR, extraction, classification, summarization, entities, comparison |
| **Drafting Agent** | Memos, letters, contracts, pleadings, briefs |
| **Review Agent** | Citations, contradictions, missing provisions, dates, definitions, consistency |

Later specialized practice-area agents (criminal, corporate, labor, family, tax, etc.) can be added.

## 3. Multi-model architecture

Agents must not depend directly on a specific provider.

```text
Agent
  │
  ▼
Model Gateway
  │
  ├── OpenAI
  ├── Anthropic
  ├── Google
  └── Open-source models
```

Routing examples (future):

| Task | Model class |
|---|---|
| Research synthesis | Strong reasoning model |
| Long document analysis | Large-context model |
| OCR | Document AI |
| Embeddings | Multilingual embedding model |
| Classification | Smaller/cheaper model |

Optimize for accuracy, latency, cost, privacy, and task type.

### Phase 1 instantiation

- One LLM provider behind a **provider interface**
- One embedding model behind the same abstraction
- No production multi-provider routing yet

## 4. Memory model

Memory is divided into four levels:

| Level | Scope | Contents |
|---|---|---|
| **Context** | Current request | Immediate prompt inputs |
| **Short-term** | Current conversation | Chat messages in the active thread |
| **Matter memory** | One matter | Documents, research, chats, drafts for that matter only |
| **Long-term** | User / workspace | Preferences, recurring workflows, firm settings |

Hierarchy:

```text
User
 │
 ├── Workspace
 │      │
 │      ├── Matter A
 │      │     ├── Documents
 │      │     ├── Research
 │      │     ├── Chats
 │      │     └── Drafts
 │      │
 │      └── Matter B
 │
 └── User Preferences
```

**Hard rule:** Matter A memory must never enter Matter B context.

### Phase 1 instantiation

- Short-term: chat messages per matter chat
- Matter memory: matter metadata + selected/uploaded docs as explicitly retrieved context
- Long-term: minimal preferences only
- No cross-matter automatic retrieval

## 5. Sandbox

Agents should not have unrestricted production access.

```text
Agent
  │
  ▼
Sandbox
  │
  ├── Temporary files
  ├── Code execution
  ├── Document processing
  └── Restricted network
```

Flow:

```text
Sandbox → Validated output → Production system
```

Sandbox receives narrowly scoped credentials and temporary access. Critical when agents execute code, manipulate documents, or call external APIs.

### Phase 1 instantiation

- No general-purpose code-execution sandbox
- Secure file handling and restricted storage credentials only
- Design APIs so a sandbox boundary can be introduced in Phase 2

## 6. Human-in-the-loop (HITL)

HITL is a core product feature, not only a safety add-on.

| Risk level | Behavior | Example |
|---|---|---|
| **Low** | Automatic | Summarize this contract |
| **Medium** | AI drafts → lawyer approves | Draft response to opposing counsel |
| **High** | Prepare → review → explicit confirmation → execute | File something with a court |

```text
Risk Level
   │
   ├── Low → Automatic
   │
   ├── Medium → Review
   │
   └── High → Explicit approval
```

### Phase 1 instantiation

- All chat answers are advisory; no external filing/execution tools
- Schema/design notes for future approval workflows
- Full HITL product UI is Phase 2+

## 7. Legal answer behavior

The AI must ground legal answers in retrieved sources and distinguish:

- directly supported information
- interpretation
- incomplete evidence
- unsupported information

If the corpus is insufficient:

> “I could not find sufficient primary-source material in the current Egyptian legal corpus to answer this reliably.”

Never fabricate:

- laws
- articles
- court decisions
- case numbers
- citations
- URLs

Citations must be generated from stored source metadata only.
