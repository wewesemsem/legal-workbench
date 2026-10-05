# Evaluation & Controlled Learning

## 1. What “self-learning” means here

The model must **not** simply train itself on lawyer data in production.

Correct loop:

```text
Lawyer feedback
      ↓
Feedback store
      ↓
Evaluation dataset
      ↓
Offline evaluation
      ↓
Prompt / retrieval / routing improvements
      ↓
Controlled deployment
```

The system can learn from:

- accepted/rejected suggestions
- corrections
- citation feedback
- document classifications
- preferred drafting style
- agent failures

Changes must go through evaluation before affecting production behavior.

## 2. Evaluation architecture

Evaluation sits outside the production AI loop.

```text
                 Production
                     │
                     ▼
                  Telemetry
                     │
                     ▼
              Evaluation Store
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       Accuracy    Safety     Latency
          │          │          │
          └──────────┼──────────┘
                     ▼
                Regression
                   Tests
                     │
                     ▼
              New Model/Agent
                     │
                     ▼
                 Evaluation
                     │
                  PASS?
                  /    \
                YES     NO
                 │       │
              Deploy   Reject
```

## 3. Testing stack (eventual)

```text
Unit tests
→ Integration tests
→ Agent evals
→ Legal citation evals
→ Adversarial tests
→ Security tests
→ Load tests
→ Production telemetry
```

## 4. Phase 1 stance

- Capture basic telemetry for chat/RAG (request, retrieval IDs, citation IDs, failures)
- Optional simple feedback signal on answers (useful / not useful)
- No offline training pipeline
- No automatic production prompt mutation from user data
- Citation correctness checks against retrieved metadata are in-scope for Phase 1
