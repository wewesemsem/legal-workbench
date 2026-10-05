# Legal Corpus & RAG

## 1. Country-aware legal database

The legal database is country-aware from day one. Egypt is the first dataset, not a hardcoded product shape.

```text
LegalCorpus
│
├── country
├── jurisdiction
├── language
├── authority_type
├── document
├── effective_date
├── expiration_date
└── relationships
```

Example expansion:

```text
Egypt
├── Constitution
├── Laws
├── Regulations
├── Presidential Decisions
├── Ministerial Decisions
├── Court of Cassation
├── Constitutional Court
└── Other official authorities

Then UAE / SA / JO / QA / KW become additional datasets.
```

Supported country codes eventually include:

```text
EG, SA, AE, JO, QA, KW, ...
```

## 2. Separation from customer data

The legal corpus must remain separate from customer matter documents.

- Public legal sources → legal corpus retrieval
- Matter documents → matter-scoped retrieval
- Never auto-ingest customer uploads into the global corpus

## 3. Legal document model (minimum)

```text
LegalDocument
├── id
├── country
├── jurisdiction
├── language
├── document_type
├── title
├── document_number
├── year
├── issuing_authority
├── publication_date
├── effective_date
├── expiration_date
├── status
├── source_name
├── source_url
├── original_file_location
├── checksum
├── created_at
└── updated_at
```

Exact schema may be adjusted during implementation, but country/provenance fields are required.

## 4. Legal chunks

Prefer meaningful legal units over arbitrary token windows when structure allows:

```text
Document
 → Chapter
   → Section
     → Article
       → Paragraph
```

Example chunk model:

```text
LegalChunk
├── id
├── document_id
├── article
├── paragraph
├── heading
├── text
├── language
├── embedding
└── metadata
```

Each chunk must retain enough metadata to trace back to the original source.

## 5. Egyptian Phase 1 corpus policy

Prioritize publicly accessible **primary/official** legal sources.

Potential source families:

- Egyptian official legislation / Amiriya
- Supreme Constitutional Court publicly available materials
- Court of Cassation Heritage Library
- Egyptian Parliament publicly available legislative materials
- Other publicly accessible Egyptian government legal sources

Constraints:

- Do not depend on commercial legal databases for initial implementation
- Do not bypass authentication, paywalls, subscriptions, CAPTCHAs, technical controls, or robots restrictions
- Prefer primary sources over secondary commentary
- Every source must retain provenance

**Phase 1 practical approach:** curated seed corpus of public EG materials + a clean ingest pipeline. Broader automated collection only where access terms/robots allow.

## 6. RAG architecture (Phase 1)

Use **PostgreSQL + pgvector**. Do not introduce a separate vector database unless later need is demonstrated.

```text
Legal Documents
      ↓
Text Extraction
      ↓
Legal Chunking
      ↓
Embeddings
      ↓
PostgreSQL + pgvector
      ↓
Hybrid Retrieval
      ↓
LLM
      ↓
Grounded Answer
```

### Hybrid retrieval

| Mode | Good for |
|---|---|
| Keyword / full-text | `Article 69`, `Law No. 12 of 2003`, `Civil Code Article 157` |
| Vector / semantic | `When can an employer terminate an employee?` |

Combine both for Phase 1 retrieval.

## 7. Provenance & citations

Every retrieved passage must be traceable to:

```text
Country
→ Authority
→ Document
→ Article/Section
→ Source URL
```

Rules:

- Do not allow the LLM to invent citations
- Citations are generated from stored metadata
- UI must let the lawyer inspect the cited source

## 8. Arabic + English foundation

UI language ≠ legal-source language.

Supported Phase 1 foundation patterns:

```text
Arabic question
→ Arabic legal sources
→ Arabic/English response

English question
→ Arabic legal sources
→ English explanation
→ Arabic primary-source citation
```

The original Arabic legal text remains the authoritative source. Do not replace it with an AI-generated translation as the citation/source of truth.
