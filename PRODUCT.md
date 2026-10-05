# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are non-technical spreadsheet users (business operators, analysts, marketing/sales leads, accountants, and founders) who work with messy spreadsheets (`.xlsx`, `.xls`, `.csv`, `.tsv`) and need immediate chart summaries, interactive visual dashboards, and answers to analytical questions via plain natural language without needing to learn complex BI tools or write SQL.

## Product Purpose

Unsheet transforms any raw spreadsheet into an interactive, production-grade visual dashboard in seconds. It allows users to pick which fields from their uploaded spreadsheet should drive the dashboard and query their data conversationally, giving non-technical teams instant analytical clarity with zero manual configuration.

## Positioning

Zero-data-egress, client-side data intelligence. Unlike traditional cloud BI tools or cloud AI analytics platforms that require uploading confidential business spreadsheets to external servers, Unsheet runs file ingestion, data profiling, and high-performance analytical SQL queries (DuckDB-WASM) entirely inside the user's browser sandbox. The server and LLM only ever touch capped column metadata (at most 5 sanitized sample values per column), preserving privacy with instant responsiveness and zero infrastructure overhead.

## Operating Context

- Routine business reviews: uploading weekly/monthly sales logs, inventory sheets, CRM exports, marketing campaigns, or expense trackers.
- Field selection: users inspect detected columns upon upload and select the dimensions and metrics they want to summarize.
- Exploratory querying: using the conversational "Ask Your Data" drawer to ask natural language questions (e.g., "Top 5 products by revenue", "Average deal size by region") executed directly in the browser against DuckDB-WASM.
- Dashboard customization & drift recovery: refining widgets via prompt or WYSIWYG controls, and re-uploading updated sheets where schema drift is automatically detected and reconciled.

## Capabilities and Constraints

### Capabilities
- **Multi-Format Ingestion**: Ingests `.xlsx`, `.xls`, `.csv`, `.tsv` client-side with pre-decompression ZIP-bomb defenses and XML entity neutralization.
- **Field Selection**: User-guided column selection upon upload to choose target metrics and dimensions for dashboard generation.
- **Automatic Profiling**: Fast type inference (`string`, `number`, `boolean`, `date`), null counts, cardinality, and sample extraction.
- **12-Column Responsive Dashboard**: Rich widget catalog including KPI cards (with sparklines & deltas), Bar charts, Donut charts, Line trend charts, Sortable Tables, and Pivot tables.
- **Conversational Analytics ("Ask Your Data")**: Natural language queries converted to safe SQL and executed locally in DuckDB-WASM with accompanying widget suggestions.
- **Deterministic Offline Fallback**: Functional rule-based engine capable of query generation and widget refinement even when an LLM API key is absent.
- **Schema Drift Detection**: Compares incoming spreadsheet columns against existing dashboard specs and guides interactive remapping.
- **Persistence & Export**: Local browser storage (IndexedDB) for anonymous sessions and encrypted sharing via Supabase.

### Constraints
- **Zero Raw Data Egress**: Raw data rows never leave the browser sandbox.
- **Formula Neutralization**: Formula execution is disabled at runtime; only pre-computed cell values are ingested to prevent injection vulnerabilities.
- **Sandboxed Execution**: DuckDB-WASM queries are restricted to single-statement read-only `SELECT` queries validated against an AST allowlist.

## Brand Commitments

- **Name**: Unsheet
- **Tagline**: Any spreadsheet. Instant dashboard.
- **Tone**: Clean, trustworthy, empowering, and friction-free—providing enterprise-grade analytical rigor behind an intuitive consumer-grade UI.

## Evidence on Hand

- Canonical sample spreadsheets and golden fixtures in [`packages/fixtures`](file:///home/rvr/Work/basi/UnSheet/packages/fixtures).
- Full security architecture and STRIDE threat model documentation in [`README.md`](file:///home/rvr/Work/basi/UnSheet/README.md) and [`SECURITY.md`](file:///home/rvr/Work/basi/UnSheet/SECURITY.md).
- End-to-end unit, integration, and property-based test suites in [`apps/web/test`](file:///home/rvr/Work/basi/UnSheet/apps/web/test).

## Product Principles

1. **Radical Privacy by Default**: Confidential spreadsheet data stays strictly inside the user's browser sandbox. External AI models only ever receive sanitized column metadata.
2. **Zero-Jargon Accessibility**: Users should never need to understand SQL, WASM workers, or database schemas. All interactions use plain language and clear visual representations.
3. **Specification as the Product**: The declarative JSON `DashboardSpec` is the authoritative source of truth—portable, versionable, and decoupled from the rendering layer.
4. **Frictionless Control**: Offer instant smart defaults upon upload while giving users effortless control over which fields to plot and how widgets are shaped.

## Accessibility & Inclusion

- WCAG AA compliance with accessible companion data tables (`AccessibleDataTable`) for every visual chart component, ensuring screen-reader compatibility and complete keyboard navigation.
