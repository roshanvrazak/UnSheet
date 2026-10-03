# Unsheet Product Specification

## 1. Executive Summary & Product Vision

**Unsheet** is a privacy-first, client-side native spreadsheet-to-interactive-dashboard platform. It instantly transforms raw, messy spreadsheets (`.xlsx`, `.xls`, `.csv`, `.tsv`) into production-grade, interactive, accessible analytical dashboards entirely within the user's browser sandbox.

Spreadsheets remain the world's most ubiquitous analytical surface, yet standard business workflows suffer from three acute pain points:
1. **The Presentation Gap**: Sharing raw tabular sheets with executives or stakeholders leads to cognitive overload, formula corruption, and misinterpretation.
2. **The Cloud Privacy Dilemma**: Traditional BI and AI visualization tools require uploading entire proprietary workbooks—containing sensitive financial, customer, employee, or strategic data—to third-party cloud infrastructure and LLM providers.
3. **The Recurrence Tax**: Operational teams spend hours each week/month re-formatting, re-cleaning, and re-charting recurring data exports (e.g., monthly Stripe payouts, weekly sales pipelines, inventory rosters).

Unsheet solves this by executing ingestion, cleaning, statistical profiling, and analytical query execution (via DuckDB-WASM) **100% locally in the browser**. When users utilize AI capabilities (such as natural language dashboard refinement or "Ask Your Data"), Unsheet enforces an uncompromising data-isolation boundary: **only structural metadata and strictly capped sample values (max 5 values per column, max 40 characters each, formula triggers stripped) are ever sent over the wire**.

---

## 2. Browser-First Privacy Architecture & Invariants

Unsheet operates under explicit cryptographic and architectural invariants:

### Invariant 1: Zero Raw Data Egress
- Tabular row data, cell values, and raw binary spreadsheets **never** leave the local browser environment during parsing, profiling, query execution, or local rendering.
- All analytical compute runs inside DuckDB-WASM within a dedicated Web Worker.
- In anonymous/demo mode, zero state is persisted to any external server or database.

### Invariant 2: Metadata Isolation Boundary for AI Features
- All calls to external Large Language Models (LLMs) pass through a strict sanitization and bounding gateway (`packages/contracts/src/api.ts`).
- Payloads are restricted to:
  1. Column keys and sanitized names.
  2. Inferred data types and semantic roles.
  3. Aggregated summary statistics (min, max, mean, distinct count, null count).
  4. Sample values capped strictly at **5 items maximum**, with each item truncated to **40 characters maximum**, and stripped of any formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`).
- LLM outputs are validated against authoritative Zod schemas (`packages/contracts`) prior to being applied to client state. If an LLM response fails validation, the system falls back gracefully to a deterministic heuristic.

### Invariant 3: Zero-Knowledge Sharing Architecture
- When users export or share a dashboard without server persistence, dashboard specifications and encrypted snapshots are encoded directly into URL hash fragments (which are never transmitted to web servers in HTTP requests).
- When persistent cloud share links are generated via Supabase, records are protected with cryptographically unguessable tokens (>= 128 bits of entropy), configurable expiration timestamps, and deny-by-default Row-Level Security (RLS).

---

## 3. End-to-End Pipeline Breakdown

```
Spreadsheet Ingest (XLSX, CSV)
      │
      ▼
┌──────────────┐
│  1. PARSE    │ ───► Hardened SheetJS vendor parse, zip-bomb defense, cached values only
└──────┬───────┘
      │
      ▼
┌──────────────┐
│ 2. NORMALISE │ ───► Header detection, spacer stripping, prototype-safe column keys
└──────┬───────┘
      │
      ▼
┌──────────────┐
│  3. PROFILE  │ ───► Statistical distributions, type & semantic role inference, capped samples
└──────┬───────┘
      │
      ▼
┌──────────────┐
│  4. SPECGEN  │ ───► Deterministic heuristic rules engine (KPIs, Trends, Breakdowns, Tables)
└──────┬───────┘
      │
      ▼
┌──────────────┐
│ 5. VALIDATE  │ ───► Authoritative Zod schema validation (@unsheet/contracts)
└──────┬───────┘
      │
      ▼
┌──────────────┐
│   6. EDIT    │ ───► WYSIWYG grid arrangement, metric adjustments, NL refinement
└──────┬───────┘
      │
      ▼
┌──────────────┐
│  7. RENDER   │ ───► Total renderer: Recharts + shadcn/ui, cross-filters, WCAG AA tables
└──────┬───────┘
      │
      ├───────────────────────┬────────────────────────┬──────────────────────┐
      ▼                       ▼                        ▼                      ▼
┌──────────────┐       ┌──────────────┐         ┌──────────────┐       ┌──────────────┐
│ 8. TEMPLATE  │       │   9. DRIFT   │         │   10. ASK    │       │  11. SHARE   │
│ Spec + Hash  │       │ Schema Match │         │ DuckDB NL-SQL│       │ >=128-bit    │
└──────────────┘       └──────────────┘         └──────────────┘       └──────────────┘
```

### Stage 1: Parse
- **Input**: Raw binary buffer (`ArrayBuffer`) or text (`File` object) from drag-and-drop or file picker.
- **Safety Checks**:
  - File size cap: 10MB raw file size limit (`MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024`).
  - Uncompressed size cap: 200MB maximum uncompressed memory footprint (`MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024`).
  - Compression ratio: abort if uncompressed / compressed ratio exceeds 100:1 (zip-bomb defense).
  - Sheet count cap: maximum 20 sheets per workbook (`MAX_SHEETS = 20`).
  - Sheet bounds check: maximum 200,000 rows (`MAX_ROWS = 200_000`) and 200 columns (`MAX_COLUMNS = 200`).
- **Execution**: SheetJS parser loaded strictly from the verified vendor tarball (`cdn.sheetjs.com/xlsx-0.20.3`). Read cached formula values only (`cell.v`); **never** evaluate formulas or resolve external hyperlinked workbooks.
- **Output**: Raw cell matrix representation.

### Stage 2: Normalise
- **Heuristic Table Region Detection**: Scan for title blocks, notes, and blank spacer rows above the table header.
- **Header Detection**: Multi-column heuristic analyzing string density, non-null ratios, and row position (confidence score 0 to 1).
- **Sanitization & Prototype Pollution Defense**:
  - Transform raw header strings into safe programmatic keys (`^[a-zA-Z_][a-zA-Z0-9_]*$`).
  - Explicitly reject and rename dangerous property keys: `__proto__`, `constructor`, `prototype`.
  - Handle collisions (e.g. `Revenue`, `Revenue` -> `revenue`, `revenue_1`).
- **Data Cleanup**: Strip trailing total/subtotal summary rows, strip blank rows, normalize nulls and empty strings to typed nulls.
- **Output**: Conforms to `WorkbookModel` and `SheetModel` (`packages/contracts/src/workbook.ts`).

### Stage 3: Profile
- **Type Inference**: Multi-pass type detection across every column:
  - `number`: Integers, floats, negative values, scientific notation.
  - `currency`: Symbol-prefixed numbers (`$`, `€`, `£`, `¥`), ISO currency codes.
  - `percent`: Percentage-formatted numbers (`%`).
  - `date`: ISO-8601 strings, standard localized date formats, Excel 1900/1904 serial numbers.
  - `boolean`: `true`/`false`, `1`/`0`, `yes`/`no`.
  - `id`: High-cardinality alphanumeric identifiers, UUIDs, incrementing integers.
  - `category`: Low-cardinality strings (uniqueness ratio < 0.2 or distinct count <= 50).
  - `text`: Free-form descriptive strings.
- **Semantic Role Assignment**:
  - `measure`: Quantifiable numeric/currency/percent columns suitable for aggregation (`sum`, `avg`).
  - `dimension`: Discrete categories or entities suitable for grouping (`slice`, `bar`, `pivot`).
  - `time`: Date/timestamp columns suitable for trend axes (`line`, `area`).
  - `identifier`: Keys suitable for row-level drilldown or entity tracking.
- **Statistical Aggregation**: Compute `min`, `max`, `mean`, `median`, `sum`, `stdDev`, `distinctCount`, `nullCount`.
- **Sample Extraction**: Extract up to 5 representative non-null values, truncated to <= 40 chars, with formula prefixes neutralized.
- **Output**: Conforms to `ColumnProfile` and `SheetProfile` (`packages/contracts/src/profile.ts`).

### Stage 4: SpecGen (Deterministic Spec Generation)
- **Rules Engine**:
  - If a `time` column and >=1 `measure` exist -> Generate `LineChartWidgetSpec` (time series).
  - For top categorical `dimension` with 3 to 7 distinct values and 1 `measure` -> Generate `DonutChartWidgetSpec` (share of whole).
  - For categorical `dimension` with 8 to 20 distinct values and 1 `measure` -> Generate `BarChartWidgetSpec` (comparative ranking).
  - For primary `measure` columns (top 2 to 4) -> Generate `KPIWidgetSpec` summary cards with summary aggregations.
  - Always include a `TableWidgetSpec` for granular inspection with pagination, sorting, and formatted cells.
- **Layout Planner**: Place KPIs in a 3- or 4-column top row (height 2), primary trend charts across 8 columns (height 4), categorical breakdowns across 4 or 6 columns, and table view at bottom (12 columns).
- **Output**: Conforms to `DashboardSpec` (`packages/contracts/src/spec.ts`).

### Stage 5: Validate
- Execute runtime validation using `DashboardSpecSchema.parse()`.
- Discriminated union verification: strictly guarantees widget `type` is one of `kpi`, `line`, `bar`, `donut`, `table`, `pivot`.
- Ensure all column references exist in the active `SheetModel`.

### Stage 6: Edit
- Interactive, responsive layout manipulation using grid positioning (`x`, `y`, `w`, `h`).
- Inspector panel to toggle aggregations (`sum`, `avg`, `min`, `max`, `distinctCount`), change visual formats, adjust color schemes, and re-assign dimensions.
- Natural Language Assistant: users can instruct the AI (e.g. *"Show average deal size by sales rep and filter out cancelled deals"*).
- Metadata-only request sent to `/api/refine-spec`; validated response updates the `DashboardSpec` immutably.

### Stage 7: Render
- **Total Renderer**: Renders any valid `DashboardSpec`. If a widget contains an unresolvable column or malformed parameter, an inline error card is displayed without breaking the rest of the dashboard.
- **Component Stack**:
  - Recharts for vector-rendered, responsive charts.
  - shadcn/ui (Radix UI primitives) for accessible controls, dialogs, dropdowns, and tabs.
  - Global Filter Bar: interactive multi-selects and date ranges that reactively dispatch filter criteria to local DuckDB queries.
- **Accessibility (WCAG 2.1 AA)**:
  - High-contrast color palettes.
  - Every chart provides a 1-click toggle to an accessible HTML table representation.
  - Screen reader announcements for active filters and KPI metrics.

### Stage 8: Template
- Save any configured `DashboardSpec` as a reusable template.
- Generates a `SchemaFingerprint` containing:
  - SHA-256 hash of normalized column names and expected types.
  - Column specifications (key, name, expected type, required flag).
- Templates stored locally in browser `IndexedDB` or shared via template exports.

### Stage 9: Drift Detection & Automated Remapping
- When uploading a new spreadsheet to an existing template:
  1. Computes similarity matrix between expected columns and uploaded columns (Levenshtein distance + token set ratio + type compatibility).
  2. Detects:
     - `matched`: Column name and type match cleanly.
     - `renamed`: Column name changed (e.g., `Rev` vs `Revenue`), but type and distribution match.
     - `type_changed`: Name matches, but data type differs (e.g. string numbers vs numeric values).
     - `missing`: Expected column absent.
     - `added`: New column present in upload.
  3. Displays a visual 1-click column remapping modal if breaking changes or missing columns are detected.
  4. Generates a `DriftReport` (`packages/contracts/src/drift.ts`).

### Stage 10: Ask Your Data (In-Browser Conversational BI)
- User asks a plain English question: *"Which rep had the highest margin in Q3?"*
- Client sends: question + column profiles (names, types, roles, capped samples <= 5 items <= 40 chars).
- LLM outputs: structured `QueryPlan` or single-statement `SELECT` query.
- Client validation: AST parser confirms SQL is purely a single `SELECT` statement against registered DuckDB tables (no DDL/DML, no file/network functions).
- DuckDB-WASM executes query against in-memory table in < 50ms and returns `QueryResult`.
- UI renders an ephemeral insight card or suggested chart widget.

### Stage 11: Share & Export
- **Export Formats**:
  - PDF: High-resolution vector capture of active dashboard layout.
  - PNG: Crisp screenshot export of individual widgets or full canvas.
  - CSV / XLSX: Cleaned tabular data export with formula injection sanitization (`'` prepended to dangerous characters).
  - Standalone HTML: Single-file bundle containing the dashboard spec and data snapshot for offline viewing.
- **Cloud Share**:
  - Generates unguessable >= 128-bit token.
  - Optional password protection and time-based auto-expiration.
  - Optional snapshot persistence with explicit user consent.

---

## 4. Non-Functional Requirements & Performance Budgets

| Metric | Budget / Target | Verification Method |
|---|---|---|
| Ingest & Parse Latency | < 1,000ms for 50,000 rows (CSV/XLSX) | Web Worker benchmark suite |
| Spec Generation Latency | < 250ms for up to 50 columns | Pure TS rules engine unit test |
| First Interactive Render | < 1,500ms from file drop | Playwright synthetic user test |
| DuckDB-WASM Query Latency | < 100ms for typical dashboard aggregations | DuckDB query benchmark |
| UI Frame Rate | 60 FPS during resizing and dragging | Chrome DevTools Performance profile |
| Bundle Size (Engine + Contracts) | < 250 KB (gzip, excluding DuckDB wasm binary) | Vite / Bundle-analyzer audit |
| Accessibility Compliance | 100% WCAG 2.1 AA | Automated `@axe-core/playwright` audit |
| Memory Footprint | < 250 MB browser RAM during peak 100k row ingest | V8 memory snapshot |

---

## 5. Summary of Architectural Guarantees

1. **Pure TypeScript Engine**: `packages/engine` has zero DOM dependencies and runs identically in Web Workers and Node.js environments.
2. **Contracts First**: All data flowing between the parser, normalizer, profiler, spec generator, renderer, and API is validated by `packages/contracts`.
3. **Defense in Depth**: Every external string, user input, and file input is treated as hostile and sanitized at each architectural boundary.
