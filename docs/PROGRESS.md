# Unsheet Development Progress Ledger

| Phase | Description | Status | Active / Assigned Agents | Commit SHA | Open Findings | Key Metrics |
|---|---|---|---|---|---|---|
| **Phase 0** | Foundation (Contracts, Tooling, CI, Specs) | **COMPLETED** | architect, devops-engineer, security-reviewer, code-reviewer, adversarial-tester | `b694a3b` | 0 blocking (all 8 adversarial + 12 security/code review findings remediated) | 69/69 tests passing; 100% strict TS; clean verify gate |
| **Phase 1** | Parse & Normalise | **COMPLETED** | fixtures-engineer, ingest-engineer, architect, security-reviewer, code-reviewer, adversarial-tester | `331f1bc` | 0 blocking (all 12 adversarial + 16 security + 15 code review findings remediated) | 398/398 tests passing; 94.78% lines / 91.95% branch coverage; 28 fixtures; clean verify gate |
| **Phase 2** | Profile & Generate Spec | **COMPLETED** | profiling-engineer, architect, security-reviewer, code-reviewer, adversarial-tester | `cee156c` | 0 blocking (all 11 adversarial + 9 security + 9 code review findings remediated) | 460/460 tests passing; 100% column inference accuracy (341/341 columns across 28 fixtures); clean verify gate |
| **Phase 3** | Query & Render (MVP) | **COMPLETED** | query-engineer, devops-engineer, frontend-engineer, architect, security-reviewer, code-reviewer, adversarial-tester | `df66fd1` | 0 blocking (all 12 security + 10 code review + 7 adversarial findings remediated) | 585/585 tests passing across 36 test files; Next.js 15 App Router production build; DuckDB-WASM + in-memory fallback; Total Renderer 12-column grid; 100% WCAG AA a11y companion tables; clean verify gate |
| **Phase 4** | Editor, Templates, Drift | **COMPLETED** | frontend-engineer, profiling-engineer, devops-engineer, security-reviewer, code-reviewer, adversarial-tester | `1c17f23` | 0 blocking (all 4 security + 4 code review + 7 adversarial findings remediated) | 604/604 tests passing across 42 test files; Visual Editor; Template storage with 1MB bounds; Schema Drift UI with remappings; clean verify gate |
| **Phase 5** | LLM Features | **COMPLETED** | backend-engineer, frontend-engineer, test-engineer, devops-engineer, security-reviewer, code-reviewer, adversarial-tester | `7e03ed5` | 0 blocking (all findings remediated, 100% review approval) | 614/614 tests passing across 44 test files; Ask-Your-Data; Spec Refinement; sliding-window rate limiters; 15-vector prompt injection corpus; 100% data privacy (zero raw row egress); clean verify gate |
| **Phase 6** | Share & Export | **COMPLETED** | backend-engineer, ingest-engineer, frontend-engineer, security-reviewer, code-reviewer, adversarial-tester | `1004591` | 0 blocking (all 3 reviews approved; 0 critical/high findings) | 634/634 tests passing across 50 test files; 128-bit unguessable share tokens; Supabase Postgres RLS deny-by-default; timing-safe 404 responses; safe CSV/XLSX/JSON export with formula neutralization; clean verify gate |
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

---

## Phase 3 Closure Summary (MVP)
- **DevOps & Next.js 15 Platform Setup (`apps/web`)**:
  - Next.js 15 App Router with React 19, Recharts (`^2.15.4`), Tailwind CSS, Lucide React, `@duckdb/duckdb-wasm`, and `apache-arrow`.
  - Production build producing 4/4 static prerendered pages.
  - Strict Content-Security-Policy (CSP) with `'self' 'wasm-unsafe-eval'`, `frame-ancestors 'none'`, `worker-src 'self' blob:`, and `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- **Query Engine & In-Browser DuckDB-WASM (`packages/engine/src/query/`, `apps/web/lib/query/`)**:
  - `buildWidgetQueryPlan`: Translates all 6 widget types (KPI, Line, Bar, Donut, Table, Pivot) and global active filter bindings into structured `QueryPlan` contracts.
  - `compileQueryPlanToSql`: Deterministic SQL compiler with double-quoted identifiers, escaped string literals, and escaped LIKE wildcards with `ESCAPE '\\'`.
  - `validateQueryPlanAgainstSheet`: AST and schema allowlist validation rejecting unallowlisted tables and columns.
  - `executeQueryInMemory`: Pure TypeScript in-memory evaluator for Node test environments and worker fallback, with iterative min/max (stack-safe on >120k rows) and prototype-safe string conversion.
  - DuckDB-WASM singleton in `apps/web/lib/query/duckdb.ts` with serialized FIFO mutex queue, table registration, and 5000ms query timeout.
- **Total Dashboard Renderer & Widget Registry (`apps/web/components/dashboard/`)**:
  - Generic spec-driven 12-column grid layout (`grid-cols-12`).
  - Total Renderer Guarantee: Top-level schema error fallback and per-widget `WidgetErrorBoundary` isolation; failures render a clean `ErrorCardWidget` without crashing adjacent widgets or the dashboard.
  - Spec-driven widgets: `KPIWidget`, `LineChartWidget`, `BarChartWidget`, `DonutChartWidget`, `TableWidget` (paginated, sortable, searchable), and `PivotTableWidget` (2D aggregation matrix).
  - Formula neutralization: All cell values with formula injection triggers (`=`, `+`, `-`, `@`, `\t`, `\r`, `|`) are escaped with a leading apostrophe in `formatDisplayValue` before clipboard copy or display.
  - Zero `dangerouslySetInnerHTML`: All text and titles are rendered safely via React DOM text nodes.
  - Accessibility: `AccessibleDataTable` companion table with semantic `<table>`, `<th scope="col">`, `<th scope="row">`, and persistent `.sr-only` mirror on all chart widgets.
  - Interactive Filter Bar: Dynamic select, multi-select, date range, and search controls with bidirectional synchronization.
- **Anonymous Demo Application (`apps/web/app/page.tsx`)**:
  - Header with Unsheet logo and Privacy Badge: *"100% In-Browser: your data never leaves your device"*.
  - Drag-and-drop dropzone for `.xlsx` and `.csv` files.
  - 4 one-click pre-loaded sample workbooks (Project Pipeline, BOQ & Quotes, Supplier Lead Times, Messy Workbook).
  - Live 5-stage pipeline timing bar (Parse -> Normalise -> Profile -> SpecGen -> Render) with millisecond execution counters.
  - Multi-sheet tab navigation.
- **Review Gate & Remediations**:
  - Audited by `security-reviewer` (12 findings, 2 Critical, 4 High), `code-reviewer` (10 findings, 2 High), and `adversarial-tester` (7 findings, 3 High, 26 red-team tests).
  - 100% remediated across contracts, devops headers, query engine, and frontend components.
- **Verification Metrics**:
  - Monorepo tests: **36 test files, 585/585 tests passing (100%)**.
  - Strict TypeScript: `noUncheckedIndexedAccess: true`, zero `any`, zero type errors.
  - `pnpm verify`: 6/6 stages passing 100% (lint, typecheck, tests, build, secret scan, audit).

---

## Phase 4 Closure Summary
- **Visual Dashboard Editor (`apps/web/components/editor/`)**:
  - Interactive Edit Mode: `WidgetConfigModal` enabling adding/editing widgets across all 6 widget types (`kpi`, `line`, `bar`, `donut`, `table`, `pivot`).
  - Column and aggregation selectors: measure and dimension pickers filtered from `SheetProfile`, format selection (currency, percent, suffix, decimals).
  - 12-column grid coordinate enforcement: strict boundary clamping `x + w <= 12` to prevent layout overflow.
  - Global Filter configuration: `FilterConfigModal` for categorical select, multi-select, date range, numeric range, and search.
  - Per-widget actions toolbar: `WidgetActionsToolbar` with quick edit, duplicate, move, and remove controls.
- **Template Management & Schema Fingerprinting (`packages/engine/src/template/`, `apps/web/lib/template/storage.ts`)**:
  - `computeSchemaFingerprint`: deterministic SHA-256 fingerprint generated from sorted column definitions.
  - `createTemplate`: packaging `DashboardSpec` and `SchemaFingerprint` into validated `Template` contract.
  - In-browser local storage persistence (`saveLocalTemplate`, `loadLocalTemplates`, `deleteLocalTemplate`) with strict `TemplateSchema.safeParse` validation discarding corrupted entries.
  - JSON import/export: `importTemplateJson` enforcing a 1MB file size cap and strict schema parsing; download/export of `.unsheet.json` template files.
  - 3 pre-packaged built-in starter templates for domain datasets (Project Pipeline, BOQ Quotes, Supplier Lead Times).
- **Interactive Schema Drift UI & Spec Remapping (`packages/engine/src/drift/`, `apps/web/components/drift/`)**:
  - `applyRemappings`: pure engine function substituting column keys across all 6 widget types, filters, and bindings with prototype pollution defense (`__proto__`, `constructor`, `prototype` rejection).
  - `DriftResolutionModal`: visual report displaying overall match confidence, breaking changes alert, matched columns with green checks, and dropdown remapping selectors for missing columns.
  - "Apply Remapped Dashboard" workflow: user-confirmed remappings are compiled and applied to update the active dashboard.
- **Review Gate & Remediations**:
  - Audited by `security-reviewer` (4 findings: 1 High, 2 Med, 1 Low), `code-reviewer` (4 findings: 2 High, 1 Med, 1 Low), and `adversarial-tester` (7 vectors tested).
  - 100% remediated across prototype defense in `applyRemappings`, 1MB bounds & Zod parsing in storage, dialog WCAG AA attributes, and HTML input length constraints.
- **Verification Metrics**:
  - Monorepo tests: **42 test files, 604/604 tests passing (100%)**.
  - Strict TypeScript: `noUncheckedIndexedAccess: true`, zero `any`, zero type errors.
  - `pnpm verify`: 6/6 stages passing 100% (lint, typecheck, tests, build, secret scan, audit).

---

## Phase 5 Closure Summary (LLM Features & Ask-Your-Data)
- **Vercel AI SDK Integration & Backend Endpoints (`apps/web/app/api/`)**:
  - `/api/query/ask`: Natural language spreadsheet question to single-statement SQL SELECT and widget recommendation conforming to `AskYourDataResponseSchema`.
  - `/api/spec/refine`: Natural language dashboard spec refiner modifying widgets and layout dynamically within 12-column grid bounds conforming to `SpecRefinementResponseSchema`.
  - Sliding-window IP rate limiters (`apps/web/lib/llm/rate-limit.ts`) enforcing 30 req/min for Ask queries and 20 req/min for Spec Refinement with standard `429 Too Many Requests` and `Retry-After` headers.
  - Deterministic heuristics fallback (`apps/web/lib/llm/fallback.ts`) ensuring 100% uptime and offline test capability without external API dependencies.
- **Client-Side Privacy Boundary & Prompt Injection Defense (`apps/web/lib/llm/prompts.ts`)**:
  - Zero raw row data egress: only `LLMColumnProfile` metadata and <=5 sample values truncated to 40 characters are transmitted.
  - Structural XML encapsulation inside `<schema_metadata>` with strict system instructions forbidding the model from executing instructions embedded in column names or sample values.
  - Mathematical SQL injection defense: LLM output validated via AST parser against `SafeSqlQuerySchema` (prohibiting DDL/DML, `ATTACH`, `COPY`, file functions) with column allowlisting against active sheet profiles.
- **Conversational UI & Dashboard Refinement (`apps/web/components/chat/`)**:
  - `AskYourDataDrawer`: Accessible slide-out panel (`role="dialog"`, `aria-modal="true"`) with dynamic sample chips, natural language input, SQL query preview with `aria-expanded` toggle, and one-click "Add to Dashboard" button.
  - `SpecRefineBar`: Natural language refinement bar with applied change tags and full instant "Undo" support.
  - Integration into `apps/web/app/page.tsx` with dedicated action toolbar triggers and sheet profile memoization.
- **Evaluation Suite & Prompt Injection Corpus (`evals/`)**:
  - `evals/prompt_injection.json`: 15 adversarial attack vectors (system overrides, jailbreaks, delimiter breakouts, SQL injections, DuckDB file reads, markdown exfiltrations, prototype pollution, oversized strings).
  - `evals/prompt_injection.test.ts`: Automated evaluation suite verifying 100% schema compliance, zero DDL/DML, zero prompt breakouts, and zero unallowlisted columns across all adversarial vectors.
- **Review Gate & Remediations**:
  - Audited by `security-reviewer` (`docs/reviews/security-phase5.md` - APPROVED, 0 Critical/High), `code-reviewer` (`docs/reviews/code-review-phase5.md` - APPROVED, Low Risk), and `adversarial-tester` (`docs/reviews/adversarial-phase5.md` - APPROVED).
  - Accessibility finding remediated: `aria-expanded` and `aria-label` added to SQL query toggle in `AskYourDataDrawer`.
- **Verification Metrics**:
  - Monorepo tests: **44 test files, 614/614 tests passing (100%)**.
  - Strict TypeScript: `noUncheckedIndexedAccess: true`, zero `any`, zero type errors.
  - `pnpm verify`: 6/6 stages passing 100% (lint, typecheck, tests, build, secret scan, audit).

---

## Phase 6 Closure Summary (Share Links, Supabase RLS & Safe Export)
- **Supabase Postgres Persistence & RLS (`supabase/migrations/`)**:
  - `templates` and `share_links` tables created with UUID keys, foreign key cascading/set-null, JSONB specs/fingerprints/snapshots, and timestamps.
  - Row Level Security (RLS) enabled on all tables with deny-by-default isolation (`auth.uid() = user_id`) proving user A cannot access or modify user B's templates.
  - Public read policies for active unexpired share links (`is_revoked = false AND (expires_at IS NULL OR expires_at > now())`).
- **Cryptographic Share Links & Enumeration Defense (`apps/web/app/api/share/`)**:
  - Token generation: 128 bits of cryptographic entropy (`crypto.randomBytes(16).toString('base64url')`), producing 22 URL-safe characters conforming to `ShareTokenSchema`.
  - Rate limiting: sliding-window limiter enforcing 60 lookups/min per IP to prevent brute-force token enumeration.
  - Enumeration oracle prevention: `GET /api/share/[token]` returns an IDENTICAL HTTP 404 response (`{ error: 'Share link not found or expired' }`) for missing, expired, revoked, or malformed tokens, eliminating timing and status oracles.
  - Data privacy: snapshots are strictly capped at 10,000 rows and only stored when the user explicitly opts in.
- **Safe Export Engine (`packages/engine/src/export/`)**:
  - `exportToCsv`: RFC 4180 compliant CSV serialization with automatic formula neutralization on all string cells and headers starting with `=`, `+`, `-`, `@`, `\t`, `\r`, `\n`, or `|` prepending `'`.
  - `exportToXlsx`: SheetJS Excel workbook generator enforcing string literal cell types (`cell.t = 's'`) with formula neutralization to prevent formula execution in spreadsheet applications.
  - `exportToJson`: Safe formatted JSON serialization with formula neutralization.
  - Property-based testing with `fast-check` verifying zero unescaped formula triggers in exported outputs.
- **Frontend Sharing & Export UI (`apps/web/components/`, `apps/web/app/share/`)**:
  - `ShareModal`: Accessible modal (`role="dialog"`, `aria-modal="true"`) to configure link expiry (24h, 7d, 30d, never), optional export permission, and optional data snapshot with clear privacy warning.
  - `ExportDropdown`: Header dropdown with one-click safe downloads for CSV, XLSX, and JSON with formula neutralization.
  - `/share/[token]`: Public view-only page rendering `DashboardRenderer` in read-only mode with data snapshot fallback.
- **Review Gate & Remediations**:
  - Audited and approved by `security-reviewer` (`docs/reviews/security-phase6.md` - PASSED, 0 Critical, 0 High, 0 Medium, 0 Low).
  - Audited and approved by `code-reviewer` (`docs/reviews/code-review-phase6.md` - APPROVED).
  - Audited and tested by `adversarial-tester` (`docs/reviews/adversarial-phase6.md` - APPROVED with automated test suites in `export_adversarial.test.ts` and `share_adversarial.test.ts`).
- **Verification Metrics**:
  - Monorepo tests: **50 test files, 634/634 tests passing (100%)**.
  - Strict TypeScript: `noUncheckedIndexedAccess: true`, zero `any`, zero type errors.
  - `pnpm verify`: 6/6 stages passing 100% (lint, typecheck, tests, build, secret scan, audit).



