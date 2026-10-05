# Development Roadmap

Organize delivery into four major phases. Do not pull later-phase systems into Phase 1 without an explicit necessity explanation.

## Phase 1 — Foundation (Egypt)

- Authentication
- Users
- Lawyer / client accounts
- Workspaces
- Matters
- Documents
- Chat
- Basic legal corpus
- Basic RAG
- Citations
- Security foundation

## Phase 2 — AI Workbench

- Multi-agent system
- Model gateway
- Document AI
- Research agent
- Drafting agent
- Review agent
- Memory (deeper matter / long-term)
- Human-in-the-loop product workflows
- Tool execution
- Agent control loop
- Sandbox boundary for tool/code execution

## Phase 3 — Professional Platform

- Client portal
- Collaboration
- Matter management depth
- Advanced legal research
- Document comparison
- Legal timelines
- Advanced drafting
- Feedback / evaluation system
- Pro subscriptions

## Phase 4 — Scale

- Infrastructure optimization
- Dedicated environments
- Enterprise security
- Evals at depth
- Penetration testing
- Load testing
- Observability
- More countries

## Geographic expansion sequence

```text
Egypt → UAE → Saudi Arabia → Jordan → Qatar → broader MENA
```

## Infrastructure timing

Application architecture first:

```text
UI → API → Orchestrator → Agents → Models/Tools → Memory/Knowledge
```

Infrastructure architecture later:

```text
Internet → CDN/WAF → Load Balancer → App/API compute
  → Service layer → PostgreSQL / Object Storage / Vector
  → IAM + encryption + secrets + networking + monitoring + logging + isolation
```

Do not block Phase 1 on production-grade multi-region infrastructure.
