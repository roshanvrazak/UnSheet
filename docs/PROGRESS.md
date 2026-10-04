# Unsheet Development Progress Ledger

| Phase | Description | Status | Active / Assigned Agents | Commit SHA | Open Findings | Key Metrics |
|---|---|---|---|---|---|---|
| **Phase 0** | Foundation (Contracts, Tooling, CI, Specs) | **COMPLETED** | architect, devops-engineer, security-reviewer, code-reviewer, adversarial-tester | `b694a3b` | 0 blocking (all 8 adversarial + 12 security/code review findings remediated) | 69/69 tests passing; 100% strict TS; clean verify gate |
| **Phase 1** | Parse & Normalise | **COMPLETED** | fixtures-engineer, ingest-engineer, architect, security-reviewer, code-reviewer, adversarial-tester | `331f1bc` | 0 blocking (all 12 adversarial + 16 security + 15 code review findings remediated) | 398/398 tests passing; 94.78% lines / 91.95% branch coverage; 28 fixtures; clean verify gate |
| **Phase 2** | Profile & Generate Spec | **COMPLETED** | profiling-engineer, architect, security-reviewer, code-reviewer, adversarial-tester | `cee156c` | 0 blocking (all 11 adversarial + 9 security + 9 code review findings remediated) | 460/460 tests passing; 100% column inference accuracy (341/341 columns across 28 fixtures); clean verify gate |
| **Phase 3** | Query & Render (MVP) | IN PROGRESS | query-engineer, frontend-engineer | - | - | - |
| **Phase 4** | Editor, Templates, Drift | PENDING | frontend-engineer, backend-engineer, profiling-engineer | - | - | - |
| **Phase 5** | LLM Features | PENDING | backend-engineer, query-engineer | - | - | - |
| **Phase 6** | Share & Export | PENDING | backend-engineer, frontend-engineer | - | - | - |
| **Phase 7** | Hardening & Release | PENDING | all reviewers, devops-engineer, docs-writer | - | - | - |

---

## Phase 0 Closure Summary
- **Architecture & Specs**: Authored `docs/SPEC.md`, `docs/ARCHITECTURE.md` (with 6 Mermaid diagrams), `docs/THREAT_MODEL.md` (STRIDE mapping).
- **Core Contracts**: Authored comprehensive Zod schemas in `@unsheet/contracts` with zero runtime dependencies other than Zod.
- **Review Gate**: Conducted full independent review by `security-reviewer`, `code-reviewer`, and `adversarial-tester`.
- **Remediations**:
  - SEC-01 & REV-P0-05: Category frequency sanitized against formula injection; `LLMColumnProfileSchema` created omitting `topValues` for AI boundary.
  - SEC-02: `ChatMessageSchema.role` restricted to `['user', 'assistant']`.
  - SEC-03, ADV-P0-02, REV-P0-08: `SampleValueSchema` hardened against leading whitespace, newlines, and pipe prefixes.
  - SEC-04, ADV-P0-06: Ingestion bounds strictly enforced (10MB file, 200k rows, 200 cols, 20 sheets).
  - SEC-05, REV-P0-10: `SafeSqlQuerySchema` implemented (SELECT/WITH only, no DDL/DML, no file functions).
  - SEC-06: Dedicated `packages/contracts/src/export.ts` with formula neutralization.
  - REV-P0-03, ADV-P0-01: `SafeUrlSchema` enforcing `http:` or `https:`.
  - REV-P0-04, ADV-P0-05: `WidgetGridPositionSchema` enforcing `x + w <= 12`.
  - REV-P0-09, ADV-P0-04: `SafeEntityIdSchema` deployed across all entity IDs.
  - REV-P0-11: Dashboard widgets capped at 50 max.
  - ADV-P0-08, REV-P0-13: `z.number().finite()` applied to all statistical and timing metrics.
  - DevOps & Tooling: ESLint hardened against bracket notation `innerHTML`/`outerHTML` and `insertAdjacentHTML`; secret scanner enhanced with provider patterns.
- **Verification**: `pnpm verify` clean (lint, typecheck, 69 tests pass, build, secret scan, audit).

---

## Phase 1 Closure Summary
- **Synthetic Fixtures Corpus (`packages/fixtures`)**:
  - Generated all 28 synthetic workbooks (`files/*.xlsx`, `files/*.csv`) spanning edge cases: header offsets, merged headers, subtotals, blank rows/cols, footnotes, mixed types, 1900/1904 serial dates, multi-format dates, currencies, percentages, hidden sheets/cols, duplicates, relational join keys, wide (160 cols), tall (10,005 rows), RTL/Unicode, cached/uncached formulas, merged data cells, CSV variations, messy whitespace, hostile formulas, and 3 realistic domain workbooks (Project Pipeline, BOQ Quotes, Supplier Lead Times).
  - 28 Golden Normalized JSON baselines in `packages/fixtures/src/golden/` validated against `WorkbookModelSchema`.
- **Ingest & Parse Engine (`packages/engine/src/parse/`)**:
  - Pinned SheetJS vendor tarball `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (bypasses stale npm registry package).
  - Pre-decompression ZIP inspector detecting zip bombs (200MB limit, 100:1 ratio limit, 0-byte compressed bombs), corrupted Central Directory headers, and embedded macro streams (VBA, XLM `macroSheets`, `.xlsb` binary payloads).
  - File upload guards (10MB max, magic bytes validation for PK\x03\x04 / XLS OLE / CSV text, macro extension rejection for `.xlsm`, `.xlsb`, `.xlm`, `.xla`).
  - Headless, pure TypeScript parser reading cached cell values only (`cell.v`), passing `doctype: false`, `nodeProcess: false`, with prototype pollution defense on worksheet keys.
- **Normalisation Engine (`packages/engine/src/normalise/`)**:
  - Noise stripping: empty spacer rows and empty spacer columns detection/pruning; category subtotal stripping across entire rows (`Engineering Subtotal`, `Marketing Subtotal`); footnotes detection for narrow & wide tables.
  - Header detection: multi-factor statistical scoring across rows 0..20, hierarchical multi-tier header concatenation (`Location - City`, `Q1 Figures - Target`).
  - Merge handling: forward-fill top-left value across merged cells with optimized row bounding.
  - Sanitization: `safeToString` handling null prototypes (`Object.create(null)`), whitespace cell trimming, unique column identifier sanitization with prototype pollution key neutralization (`safe___proto__`), collision-free deduplication.
  - Contracts: `SheetModelSchema.name` prototype pollution guard and `WorkbookModelSchema` aggregate 200k row limit across sheets.
- **Review Gate & Remediations**:
  - Audited by `security-reviewer`, `code-reviewer`, and `adversarial-tester` (43 total findings evaluated).
  - 100% remediated across contracts, engine, and fixtures.
- **Verification Metrics**:
  - `pnpm verify`: 6/6 stages passing 100% (ESLint, strict `tsc --noEmit`, Vitest workspace, build, secret scan, audit).
  - Automated tests: 19 test files, 398 tests passing.
  - Engine test coverage: **94.78% lines** (exceeds >=90%), **91.95% branch** (exceeds >=85%), **100% functions**.

---

## Phase 2 Closure Summary
- **Data Profiling Engine (`packages/engine/src/profile/`)**:
  - Type inference (`inference.ts`): robust multi-pattern detection for numbers, currencies (symbols, accounting parens, ISO codes), percentages, dates (ISO, US/UK, named months, Excel serial dates 1900 [25k..60k] & 1904 epochs), booleans, categories (cardinality <= 50), identifiers (alphanumeric, high uniqueness), and free text.
  - Semantic role classification (`roles.ts`): dimension, measure, time, identifier.
  - Statistical analysis (`stats.ts`): finite numeric metrics (`min`, `max`, `mean`, `median`, `sum`, `variance`, `stdDev`), null counts, distinct counts, uniqueness ratios, formula-neutralized top category frequencies.
  - Privacy data boundary (`llm.ts`): `toLLMColumnProfile` and `toLLMSheetProfile` exporting sanitized column summaries and sample values capped at <=5 items and <=40 chars, omitting sensitive `topValues` to prevent prompt injection and data leaks.
  - Cross-sheet join candidate detection (`joins.ts`): relational foreign key matching based on stem similarity, type compatibility, and value set intersection (> 50%).
- **Dashboard Spec Generator (`packages/engine/src/specgen/`)**:
  - Algorithmic deterministic rules engine mapping `SheetProfile` to a complete `DashboardSpec` conforming to `@unsheet/contracts`.
  - Prominent KPI cards, line charts for time-series, donut charts for low-cardinality splits, bar charts for categorical measures, data tables, and multi-dimensional pivot tables.
  - Auto-generated global dimension and date filters.
  - Strict 12-column layout positioning (`x + w <= 12`, non-overlapping), widget and filter ID length clamping (<= 128 chars), and title whitespace trimming with safe fallbacks.
- **Schema Drift Detection (`packages/engine/src/drift/`)**:
  - Compares dashboard specs against fresh workbook profiles: matched columns, missing columns, added columns, and type changes.
  - Suggested remappings using Levenshtein distance and token similarity, capped at 128 characters to prevent quadratic complexity and ReDoS attacks.
- **Review Gate & Remediations**:
  - Conducted independent reviews by `security-reviewer`, `code-reviewer`, and `adversarial-tester` (29 total findings evaluated).
  - 100% remediated across contracts, engine profiling, specgen, and drift detection.
- **Verification Metrics**:
  - Monorepo tests: 25 test files, **460/460 tests passing**.
  - Type inference accuracy benchmark: **100% accuracy** (341/341 columns correctly typed across all 28 synthetic and domain fixtures).
  - `pnpm verify` passing 100% across all 6 verification stages.

