# PubMedChat Prototype Implementation Plan

**Status:** Prototype planning / ready for implementation  
**Owner:** Project maintainer  
**Last updated:** 2026-08-13  
**Canonical path:** `docs/pubmedchat-prototype-implementation-plan.md`

> **Implementation handoff:** Read this document before implementing PubMedChat prototype work. Treat the milestones and acceptance criteria as the implementation contract. If the existing repository differs from this plan, preserve working repository conventions, document the deviation in the Decision Log, and avoid silently changing scope.

## 1. Objective

Build a WikiChat-style, citation-first research assistant over PubMed-indexed abstracts. A user should be able to ask a biomedical literature question, receive a concise synthesis grounded in retrieved abstracts, inspect the supporting papers and excerpts, and understand the limits of the evidence.

The prototype is a **literature discovery and summarization tool**, not a clinical decision-support system or medical adviser.

### Success looks like

- A user enters a research question in natural language.
- PubMed records are searched and ranked using a reproducible local or fixture-backed index.
- The system returns a grounded answer with PMID-level citations beside substantive claims.
- Each citation opens an inspectable source card with title, journal, date, PMID, PubMed URL, and supporting abstract text.
- The system clearly handles no results, insufficient evidence, conflicting findings, API failures, and unsafe personalized-medical questions.
- The prototype can be run locally with documented commands and without committed secrets.

## 2. Scope

### 2.1 In scope for the prototype

- Natural-language PubMed literature search.
- Search-result mode showing ranked publications.
- Grounded synthesis over a small retrieved set of PubMed abstracts.
- Follow-up questions that retain the current conversation topic and/or source set.
- Filters for date range, publication type, language, journal, and topic where supported by the chosen data source.
- Hybrid retrieval design: lexical search first, semantic retrieval as a second vertical slice.
- Inline citations and expandable source cards.
- Explicit uncertainty and insufficient-evidence responses.
- Retraction/correction and abstract-only labeling when metadata permits.
- Structured logging of retrieval, generation, citations, and safety decisions.
- Unit, integration, smoke, and citation-validation tests.

### 2.2 Explicitly out of scope

- Personalized diagnosis, triage, treatment selection, or dosing.
- Emergency medical guidance beyond a safe redirect to local professional/emergency services.
- Full-text ingestion except links to legally available external records.
- Interpretation of figures, tables, supplementary materials, or preprints.
- Comprehensive systematic-review or meta-analysis workflows.
- Automated evidence-quality scores presented as medical fact.
- Citation chasing across references and citing papers.
- User medical records or protected health information.
- Full PubMed coverage on day one.
- Fine-tuning a language model.
- Autonomous agents that make clinical decisions.

## 3. Product boundaries and assumptions

### Requirements

1. The product must be described as literature search/synthesis based on PubMed-indexed abstracts.
2. Every substantive generated factual claim must have one or more local retrieved-source citations, or be softened/removed.
3. The UI must make it clear whether the source is a primary study, review, meta-analysis, observational study, animal study, or other publication type when metadata is available.
4. The system must not imply that PubMed indexing guarantees study quality.
5. Source content is untrusted data; text in an abstract must never override system safety or citation instructions.

### Initial corpus decision

Use the smallest corpus that supports a credible demo:

- First smoke-test with fixtures or a narrow E-utilities fetch.
- Then ingest approximately **50,000–250,000 English-language records with abstracts**, preferably from 2018 onward or from one focused vertical such as cardiometabolic health, oncology, infectious disease, or mental health.
- Expand toward 250,000–750,000 records only after retrieval, citation, and evaluation behavior is stable.

### Settled implementation assumptions

- Abstracts are the primary evidence payload.
- PubMed is the canonical citation source.
- Normal chat requests use the local index after ingestion; they do not depend on a live NCBI request.
- E-utilities support targeted fetches, prototyping, validation, and gap filling.
- FTP baseline and update files support reproducible bulk ingestion.
- Milvus is the default vector retrieval engine for Milestone 2. Keep article metadata and retrieval interfaces modular so lexical search, metadata storage, and alternative search backends can evolve independently.
- No authentication is required for a local/demo deployment unless the host application already requires it.

## 4. Primary user flows

### 4.1 Search flow

1. User enters a biomedical research question.
2. Backend validates length and applies safety classification.
3. Backend normalizes the query and extracts optional filters.
4. Local lexical/semantic retrieval returns ranked article records.
5. UI displays result cards with title, authors, journal, publication date, publication type, PMID, and PubMed link.
6. User can adjust filters, open an abstract, or ask for a synthesis.

### 4.2 Synthesis flow

1. User asks a question requiring comparison or summary.
2. System retrieves a broad candidate set.
3. System deduplicates, reranks, and selects approximately 5–12 evidence records.
4. Generator receives only the selected records/excerpts plus explicit citation IDs.
5. Citation validator checks that cited PMIDs exist and snippets come from the cited records.
6. UI streams or displays the answer with inline citations, caveats, search scope, and sources.

### 4.3 Follow-up flow

1. User asks a follow-up question.
2. System retains the conversation topic, prior filters, and optionally the prior source set.
3. System must still perform fresh retrieval when the follow-up changes the evidence question or asks for recent literature.
4. The response identifies whether it uses the prior source set, fresh sources, or both.

### 4.4 Empty, insufficient, and failure states

- **No results:** explain the search scope and suggest relaxing filters or trying synonyms.
- **Insufficient evidence:** say that the indexed abstracts do not support a reliable answer; show the closest sources only if useful.
- **Conflicting evidence:** summarize the disagreement and identify study designs/populations rather than forcing a single conclusion.
- **NCBI/API failure:** serve local results when possible; otherwise show a recoverable error and do not fabricate sources.
- **Malformed record:** skip it, log it, and continue ingestion.
- **Unsafe personal-health request:** provide a concise safe redirect rather than ordinary RAG output.

## 5. Proposed architecture

```text
                +-------------------+
                |  React/Next.js UI  |
                +---------+---------+
                          |
                    REST/stream API
                          |
                +---------v---------+
                |   API/orchestrator |
                | query + safety     |
                +----+----------+----+
                     |          |
          +----------v--+   +---v-------------+
          | Retrieval    |   | Answer generator |
          | lexical      |   | citation-aware  |
          | semantic     |   +---+-------------+
          | fusion/rank  |       |
          +------+-------+   +---v-------------+
                 |           | Citation check  |
                 |           +-----------------+
        +--------v------------------+
        |  Article metadata store     |
        |  + Milvus vector indexes    |
        +--------+------------------+
                 |
        +--------v------------------+
        | Object storage: raw XML/API |
        +-----------------------------+

  Background workers: FTP download, parse, normalize, embed, index, updates
  External sources: NCBI PubMed FTP and E-utilities; LLM/embedding provider
```

### Component responsibilities

- **Web UI:** chat/search input, filters, ranked results, answer rendering, citation cards, loading/error states, feedback.
- **API/orchestrator:** request validation, query classification, retrieval orchestration, answer generation, citation validation, response shaping.
- **Safety service:** classify high-risk personalized-medical requests and apply refusal/redirect policy before generation.
- **Ingestion workers:** download and checksum FTP files, parse XML as a stream, normalize records, process updates/deletions, and enqueue embeddings/indexing.
- **Retrieval service:** lexical search, vector search, rank fusion, deduplication, reranking, metadata filters, and diversification.
- **Generation service:** produce structured answers from selected evidence only.
- **Citation validator:** verify PMID existence, citation-to-record mapping, supporting excerpts, and unsupported claims where feasible.
- **Article metadata store:** canonical records, versions, traces, benchmark data, and application state; start with the smallest practical local store and introduce PostgreSQL only if needed for durability and query complexity.
- **Milvus:** vector collections for title/abstract embeddings, scalar metadata needed for retrieval filters, index parameters, and corpus-versioned retrieval experiments.
- **Object storage:** immutable raw FTP XML, API payloads, manifests, and processing reports.

## 6. PubMed ingestion requirements

### 6.1 E-utilities prototype path

Implement this first if the repository is empty or time-to-demo is the priority:

- Use `ESearch` to identify PMIDs.
- Use `EFetch` in batches to retrieve XML records.
- Cache responses.
- Configure the required NCBI `tool` and contact email.
- Respect NCBI request limits and retry transient errors with backoff.
- Persist normalized records locally so chat does not call the API on every turn.

### 6.2 FTP bulk path

Implement after the first vertical slice:

1. Download PubMed baseline archives and checksums.
2. Store immutable raw files.
3. Parse XML incrementally; do not load an archive into memory.
4. Normalize records by PMID.
5. Filter according to corpus criteria.
6. Upsert articles idempotently.
7. Build lexical documents and enqueue embedding jobs.
8. Process update and deletion files on a daily or weekly schedule.
9. Retain source filename/release, checksum, parser version, and timestamps.

### 6.3 Article schema

Minimum normalized fields:

- `pmid`
- `title`
- `abstract_text`
- `abstract_sections`
- `authors`
- `journal`
- `issn`
- `doi`
- `pmc_id`
- electronic/print/PubMed publication dates
- `language`
- `publication_types`
- `mesh_terms`
- `keywords`
- correction/retraction flags
- `source_release`
- `content_hash`
- `first_seen_at`
- `last_updated_at`
- `active`

Do not discard records solely because an abstract is missing; retain them as metadata-only records but exclude them from synthesis retrieval unless explicitly requested.

## 7. Retrieval and RAG requirements

### 7.1 Query classification and normalization

Classify requests as search, synthesis, comparison, explanation, fact lookup, unsafe personal-health request, or emergency/high-risk request. Preserve the original query. Extract entities, population, intervention, comparator, outcome, date range, study type, human/animal constraints, and likely MeSH/synonym expansions.

### 7.2 Candidate retrieval

- Lexical retrieval over title, abstract, MeSH, and publication metadata.
- Dense retrieval over title plus abstract.
- Metadata filters for date, language, journal, publication type, and topic.
- Retrieve approximately 50–100 candidates per retrieval route.
- Merge by reciprocal-rank fusion or a documented weighted score.
- Deduplicate by PMID, DOI, and near-identical titles.
- Rerank the top 30–50 candidates.
- Select approximately 5–12 sources for synthesis.
- Diversify by study design, publication date, and journal where appropriate.

### 7.3 Grounded generation contract

The generator must:

- receive only selected source excerpts and metadata;
- use stable citation IDs mapped to PMIDs;
- cite each substantive claim at sentence or clause level;
- avoid inventing numerical results or full-text details;
- use association/causal language appropriate to study design;
- distinguish review from primary evidence;
- identify mixed findings and important limitations;
- state when evidence is insufficient.

Suggested response object:

```json
{
  "answer_markdown": "...",
  "claims": [
    {
      "text": "...",
      "citation_ids": ["src_1", "src_2"]
    }
  ],
  "citations": [
    {
      "id": "src_1",
      "pmid": "12345678",
      "title": "...",
      "journal": "...",
      "publication_date": "2024-01-01",
      "publication_types": ["Randomized Controlled Trial"],
      "pubmed_url": "https://pubmed.ncbi.nlm.nih.gov/12345678/",
      "supporting_excerpt": "..."
    }
  ],
  "limitations": ["Abstract-only evidence"],
  "search_scope": {
    "retrieved_at": "...",
    "filters": {}
  },
  "safety": {
    "classification": "literature_question",
    "redirected": false
  }
}
```

## 8. API contract

Keep these routes stable even if implementation details change:

- `GET /api/health`
- `GET /api/search?q=<query>&page=<n>&page_size=<n>&...filters`
- `GET /api/articles/:pmid`
- `POST /api/chat`
- `POST /api/feedback` (optional for first slice)

Example chat request:

```json
{
  "message": "What does recent literature say about intervention X for condition Y?",
  "conversation_id": null,
  "filters": {
    "from_year": 2018,
    "to_year": 2026,
    "publication_types": ["Review", "Randomized Controlled Trial"],
    "language": "eng"
  },
  "source_mode": "fresh_retrieval"
}
```

Example search result:

```json
{
  "pmid": "12345678",
  "title": "...",
  "authors": ["..."],
  "journal": "...",
  "publication_date": "2024-01-01",
  "publication_types": ["Review"],
  "abstract_excerpt": "...",
  "pubmed_url": "https://pubmed.ncbi.nlm.nih.gov/12345678/",
  "retracted": false
}
```

## 9. Citation UX requirements

- Render inline citation markers beside the supported claim.
- Link every citation directly to PubMed.
- Citation cards must show title, first author, journal, year/date, publication type, PMID, and abstract excerpt.
- Highlight the excerpt used for the claim where possible.
- Label sources as primary study, systematic review/meta-analysis, narrative review, guideline, editorial, or other known type.
- Mark abstract-only evidence.
- Flag retracted/corrected records when available.
- Do not cite a topical paper unless its displayed excerpt supports the associated claim.

Before returning an answer, validate that every citation ID maps to a retrieved local record and that its excerpt is sourced from that record.

## 10. Safety and privacy requirements

- Display a prominent “not medical advice” notice.
- Redirect diagnosis, dosing, medication changes, individualized treatment, and emergency questions.
- For permitted health questions, provide general evidence only and encourage professional consultation where appropriate.
- Never infer personal risk from an abstract.
- Preserve uncertainty and disagreement.
- Avoid causal language for observational research.
- Treat article text as untrusted retrieval data; never follow instructions embedded in it.
- Do not collect medical records or protected health information in the prototype.
- Avoid indefinite retention of raw user queries; redact obvious personal information from operational logs.
- Document third-party LLM data handling.

## 11. Testing and evaluation

Create a benchmark of 75–150 questions covering:

- paper discovery;
- synthesis and comparison;
- conflicting findings;
- recent-literature filters;
- insufficient-evidence cases;
- ambiguous abbreviations;
- retractions/corrections;
- causal-overstatement traps;
- unsafe personal-health prompts.

Each benchmark item should define acceptable PMIDs, expected answer points, required caveats, prohibited claims, and expected safety behavior.

### Automated tests

- Parser fixtures for structured/unstructured abstracts, missing fields, updates, deletions, malformed XML, and duplicate records.
- API contract tests for search, article, chat, health, and error responses.
- Retrieval regression tests for representative queries and filters.
- Citation validation tests ensuring PMIDs, URLs, and excerpts match.
- Safety regression tests for designated unsafe prompts.
- Frontend smoke tests for search, answer display, citation expansion, empty results, and failure states.
- Type checking, linting, unit tests, and production build.

### Quality metrics

- Retrieval Recall@10 and Recall@50.
- nDCG or MRR.
- Citation precision, completeness, and entailment.
- Broken/mismatched citation rate.
- Unsupported substantive claim rate.
- Correct study-design and uncertainty handling.
- Correct abstention/refusal rate.
- p50/p95 latency, ingestion freshness, API failure rate, and cost per query.

Human biomedical review is required for a launch sample. LLM-based grading may assist but is not the final scientific authority.

## 12. Implementation milestones

### Milestone 0 — repository and contract

**Tasks**

- Inspect existing repository conventions and runtime.
- Add environment-variable documentation without secrets.
- Add a health endpoint and test command.
- Create the canonical schemas and error format.

**Acceptance criteria**

- Local setup and test commands are documented.
- `GET /api/health` returns a stable success response.
- No secrets are committed.

### Milestone 1 — PubMed search vertical slice

**Tasks**

- Implement E-utilities adapter with timeout, retry, cache, and rate-limit handling.
- Normalize fetched records.
- Add local fixture mode for offline tests.
- Implement `GET /api/search` and `GET /api/articles/:pmid`.
- Build ranked result cards and abstract view.

**Acceptance criteria**

- A representative query returns records containing PMID, title, journal, publication date, publication type when available, abstract excerpt, and PubMed URL.
- Fixture mode works without network access.
- Empty results and upstream failures have distinct, user-readable responses.

### Milestone 2 — local index and retrieval

**Tasks**

- Add a Milvus collection schema for article or abstract-chunk embeddings keyed by PMID and corpus version.
- Add a small canonical metadata store for article records and retrieval traces.
- Add lexical indexing and metadata filters, with filter fields mirrored into Milvus when practical.
- Add chunking and embedding job interfaces that upsert vectors into Milvus idempotently.
- Add Milvus index/search configuration for local development and documented defaults.
- Add rank fusion, deduplication, and optional reranking across lexical and Milvus vector candidates.

**Acceptance criteria**

- The same query with the same corpus/version produces reproducible candidate rankings within documented tie behavior.
- Filters work and are covered by tests.
- Retrieval traces record query, corpus version, Milvus collection/index version, candidates, scores, and applied filters.

### Milestone 3 — grounded chat

**Tasks**

- Implement query classification and safety routing.
- Implement `POST /api/chat`.
- Pass selected excerpts to a citation-aware generator.
- Validate citation IDs and source excerpts before response.
- Return structured answer, citations, limitations, search scope, and safety metadata.

**Acceptance criteria**

- Every substantive factual answer claim has a citation or an explicit uncertainty statement.
- No citation points to a PMID not retrieved for that answer.
- The model cannot cite a source absent from the supplied evidence context.
- Insufficient evidence produces an abstention rather than invented content.

### Milestone 4 — citation-first UI

**Tasks**

- Add inline citations and citation cards.
- Show supporting abstract excerpts.
- Add filter controls and search-scope display.
- Add loading, empty, error, and unsafe-request states.
- Add follow-up conversation behavior.

**Acceptance criteria**

- A user can navigate from each material claim to its supporting PubMed record and excerpt.
- The UI clearly labels abstract-only evidence and study type where available.
- The user can recover from an empty result or transient error.

### Milestone 5 — FTP ingestion and updates

**Tasks**

- Add FTP baseline downloader and checksum verification.
- Stream-parse baseline XML.
- Store manifests and raw artifacts.
- Add idempotent update/deletion processing.
- Add scheduled worker execution and ingestion reports.

**Acceptance criteria**

- A baseline subset can be reprocessed without duplicate articles or chunks.
- Update and deletion fixtures produce the expected active/inactive records.
- Failed records are isolated and reported without stopping the whole job.

### Milestone 6 — verification and demo hardening

**Tasks**

- Create and run the benchmark suite.
- Review a sample with a biomedical domain expert.
- Test outdated, contradictory, retracted, missing-abstract, prompt-injection, and unsafe cases.
- Add latency, cost, error, and retrieval observability.
- Deploy a shareable demo with corpus date and limitations visible.

**Acceptance criteria**

- Unit, integration, smoke, type, lint, and build checks pass.
- Citation correctness and safety regression suites pass.
- A human-reviewed launch sample meets agreed quality thresholds.
- No known critical failure remains untracked.

## 13. Suggested repository structure

Adapt this to the existing repository rather than forcing a new layout:

```text
pubmedchat/
├── apps/
│   ├── api/
│   └── web/
├── services/
│   ├── ingestion/
│   │   ├── ftp_downloader/
│   │   ├── xml_parser/
│   │   ├── normalizer/
│   │   └── updater/
│   ├── retrieval/
│   │   ├── lexical.py
│   │   ├── semantic.py
│   │   ├── fusion.py
│   │   └── reranker.py
│   ├── generation/
│   │   ├── prompts/
│   │   ├── answer_generator.py
│   │   └── citation_validator.py
│   └── safety/
│       ├── classifier.py
│       └── policy.py
├── packages/
│   ├── schemas/
│   ├── database/
│   └── pubmed/
├── evaluations/
│   ├── benchmark.jsonl
│   ├── retrieval/
│   ├── citation/
│   └── safety/
├── infra/
│   ├── docker-compose.yml
│   └── migrations/
├── scripts/
│   ├── ingest_baseline.py
│   ├── process_updates.py
│   └── rebuild_index.py
└── README.md
```

## 14. Configuration

Document names and purposes only. Never commit values:

- `PUBMED_EMAIL` — contact email sent to NCBI.
- `PUBMED_TOOL` — application identifier sent to NCBI.
- `PUBMED_API_KEY` — optional NCBI API key.
- `PUBMED_BASE_URL` — configurable NCBI endpoint.
- `DATABASE_URL` — optional canonical metadata-store connection string when a database-backed store is used.
- `MILVUS_URI` — Milvus or Zilliz endpoint for vector retrieval.
- `MILVUS_TOKEN` — optional Milvus or Zilliz authentication token.
- `MILVUS_COLLECTION` — collection name for PubMed article or chunk embeddings.
- `MILVUS_DATABASE` — optional Milvus logical database name.
- `VECTOR_DIMENSION` — embedding vector dimension expected by the Milvus collection.
- `OBJECT_STORAGE_BUCKET` — raw input/artifact bucket.
- `OBJECT_STORAGE_ENDPOINT` — optional S3-compatible endpoint.
- `LLM_API_KEY` — model-provider credential.
- `LLM_MODEL` — generation model identifier.
- `EMBEDDING_MODEL` — embedding model identifier.
- `RERANKER_MODEL` — optional reranker identifier.
- `CACHE_URL` — optional cache/queue connection.
- `LOG_LEVEL` — application log level.
- `APP_ENV` — local, staging, or production.

## 15. Local commands to document

The implementation must provide repository-appropriate commands for:

```text
install dependencies
start local services
run API
run web UI
run database migrations
ingest fixture data
run tests
run lint
run type checks
run production build
```

Do not assume these exact commands if the repository already has conventions; document the actual commands in the project README after implementation.

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| PubMed rate limits or outage | Local cache/index, throttling, retries, fixture mode |
| Large FTP files | Streaming parser, resumable jobs, raw-file manifests |
| Embedding cost | Begin with bounded corpus; batch jobs; version embeddings |
| Hallucinated claims | Selected-source-only generation, structured claims, citation validation |
| Causal overstatement | Study-type metadata and generation policy |
| Conflicting literature | Diversified retrieval and explicit disagreement section |
| Retractions/corrections | Preserve and surface status flags |
| Abstract lacks needed detail | Explicit abstract-only limitation and abstention |
| Prompt injection in source text | Treat source as untrusted data and structurally isolate it |
| Privacy leakage | No medical records; redact operational logs; document provider retention |
| Search quality too weak | Benchmark early; compare lexical, semantic, fusion, and reranking variants |
| Scope expansion | Maintain explicit deferred list and milestone acceptance criteria |

## 17. Deferred work

- Complete PubMed baseline and continuous large-scale synchronization.
- Full-text retrieval from PMC or licensed sources.
- Study-level evidence tables and structured PICO extraction.
- Topic maps, MeSH exploration, and citation graphs.
- Saved searches, alerts, workspaces, and collaboration.
- Expert annotation/review workflow.
- Alternative search or vector infrastructure beyond the initial Milvus-backed retrieval path.
- Multi-model fallback gateway and tenant quotas.
- Formal clinical validation or regulatory positioning.

## 18. Open questions

These should be resolved by the implementer only when they affect the next milestone; otherwise record an assumption in the Decision Log:

1. Which existing repository is the prototype target?
2. Which frontend/backend stack does that repository already use?
3. Which initial specialty or corpus query should define the demo?
4. Which LLM and embedding provider are available in the deployment environment?
5. Should the first vertical slice use live E-utilities, fixtures, or both?
6. Which Milvus deployment should Milestone 2 target first: local Milvus Lite/standalone, Docker Compose, or managed Zilliz Cloud?
7. What canonical metadata store should pair with Milvus for article records and retrieval traces?
8. Is public unauthenticated demo access acceptable?
9. What biomedical expert will review the benchmark sample?

## 19. Current status

- **Completed:** feasibility review; MVP scope; ingestion, retrieval, citation, safety, evaluation, milestone plan; repository selection; and the first vertical slice covering PubMed search, ranked results, article detail, fixture mode, API routes, UI, tests, and docs.
- **In progress:** none for the approved first vertical slice.
- **Blocked:** none for the first vertical slice.
- **Next recommended task:** after separate approval, extend retrieval beyond fixture-first search into a Milvus-backed local indexed corpus with richer filtering.


## 20. Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-13 | Keep the canonical plan in `docs/pubmedchat-prototype-implementation-plan.md` | Discoverable, version-controlled, and usable by both Claude Code and OMC; avoid putting a long changing plan in `CLAUDE.md`. |
| 2026-08-13 | Use PubMed FTP for reproducible bulk ingestion and E-utilities for targeted operations | FTP avoids millions of API calls for baseline loading; E-utilities are appropriate for interactive fetches and validation. |
| 2026-08-13 | Start with abstracts and a bounded corpus | Reduces implementation, indexing, cost, and evaluation complexity while preserving a credible demo. |
| 2026-08-13 | Make citations and evidence limitations first-class UX | Trust and inspectability are more important than broad unsupported medical-answer behavior. |
| 2026-08-13 | Treat the prototype as literature exploration, not clinical advice | Reduces safety risk and defines an honest product boundary. |
| 2026-08-13 | Use a fixture-first Next.js + TypeScript stack for the first vertical slice | Keeps the demo runnable offline while preserving a live E-utilities adapter boundary for later expansion. |
| 2026-08-13 | Seed fixture mode with real PubMed E-utilities records | Avoids fabricated records and keeps offline development faithful to the source corpus. |
| 2026-08-13 | Keep live E-utilities access behind an environment-selectable adapter boundary | Lets fixture mode stay the default while allowing live validation when configured. |
| 2026-08-13 | Use Milvus as the Milestone 2 vector retrieval engine | Milvus provides a dedicated vector database path for semantic retrieval while keeping article metadata and lexical retrieval modular. |

## 21. Agent handoff instruction

At the beginning of an implementation session, use:

> Read `docs/pubmedchat-prototype-implementation-plan.md` first. Treat it as the implementation contract, inspect the repository for contradictions, implement the next unblocked milestone, run the documented verification checks, and update the Current Status and Decision Log when decisions change.
