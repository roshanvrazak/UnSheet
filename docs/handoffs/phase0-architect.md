# Phase 0 Architecture & Contracts Handoff

## 1. Executive Summary

Phase 0 Architecture & Contracts deliverables are complete, verified, and committed. The architectural foundation, threat model, and product specifications have been documented in detail. The authoritative `@unsheet/contracts` package has been authored with comprehensive Zod schemas, inferred strict TypeScript types, zero runtime dependencies other than `zod`, and 100% test pass rates across the test suite.

---

## 2. Authored Specifications & Documentation

The following core specification documents are published in `docs/`:

1. **`docs/SPEC.md`**:
   - Comprehensive product vision and browser-first privacy invariants.
   - Detailed 11-stage pipeline:
     `Parse -> Normalise -> Profile -> SpecGen -> Validate -> Edit -> Render -> Template -> Drift -> Ask -> Share`.
   - Performance budgets (< 1s parsing for 50k rows, < 2s first interactive render, < 100ms DuckDB-WASM query response time).
   - Strict accessibility standards (WCAG 2.1 AA) and responsive layout guidelines.

2. **`docs/ARCHITECTURE.md`**:
   - System topology and monorepo workspace boundaries (`contracts`, `engine`, `fixtures`, `web`).
   - Browser-first client architecture with dedicated Web Worker execution for `@unsheet/engine` and DuckDB-WASM.
   - 6 comprehensive Mermaid diagrams:
     1. High-Level Architecture Diagram
     2. Privacy Boundary & Data Isolation Model
     3. Ingestion & Profiling Dataflow Diagram
     4. Query Execution & Interactive Filtering Lifecycle Sequence Diagram
     5. Schema Drift Detection & Template Application Flowchart
     6. LLM Metadata Isolation & Spec Refinement Sequence Diagram

3. **`docs/THREAT_MODEL.md`**:
   - Comprehensive STRIDE threat model (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).
   - In-depth technical specifications for all **14 Mandatory Security Mitigations**:
     1. Upload file size, memory caps & zip-bomb defense (< 50MB, ratio < 100:1, cell caps).
     2. XML entity expansion / billion laughs defense (`doctype: false`).
     3. Formula execution sandbox & link disabling (cached values only).
     4. Prototype pollution prevention (`FORBIDDEN_OBJECT_KEYS`, `SafeIdentifier`).
     5. Formula injection neutralization in export paths (`'` prepended on `=, +, -, @, \t, \r`).
     6. XSS neutralization & zero `dangerouslySetInnerHTML` (AST ESLint enforcement).
     7. Strict Content Security Policy (CSP) & security headers.
     8. Prompt injection & data privacy in LLM calls (strictly capped samples <= 5 items <= 40 chars, formula characters stripped, zero raw row egress).
     9. DuckDB-WASM sandbox & SQL injection mitigation (AST single `SELECT` parser, allowlisted tables/columns).
     10. Client-side data isolation / zero server persistence by default.
     11. Cryptographically secure share links (>= 128-bit entropy, expiration, revocation).
     12. Supabase RLS and token entropy (deny-by-default policies).
     13. API rate limiting, spend protection & kill-switch (`DISABLE_LLM=true`).
     14. Supply chain integrity & secrets management (pinned SheetJS vendor tarball, secret scanning, high-severity audit gates).
   - Complete STRIDE Threat Matrix mapping each threat, attack vector, component, and mitigation ID.

---

## 3. Package `@unsheet/contracts` Architecture

The contracts package (`packages/contracts`) serves as the single source of truth across all workspaces.

### Dependencies
- **Runtime dependencies**: `zod` only.
- **Zero DOM dependencies**: Compatible with Node.js, Web Workers, and browser main thread.
- **TypeScript strictness**: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.

### Exported Modules & Schemas
- **`src/common.ts`**:
  - `SafeIdentifierSchema` / `SafeIdentifier`: Validates safe column identifiers (`/^[a-zA-Z_][a-zA-Z0-9_]*$/`), explicitly forbidding `__proto__`, `constructor`, `prototype`.
  - `SampleValueSchema` / `SampleValue`: Bounded string (<= 40 chars) stripped of formula injection prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`).
  - `SampleValuesArraySchema`: Capped array (max 5 items).
  - `TitleSchema`, `DescriptionSchema`, `IsoDateTimeSchema`, `SemanticVersionSchema`, `VersionSchema`.
- **`src/workbook.ts`**:
  - `CellModelSchema` / `CellModel`: Normalized cell model with row/col index, raw value, formatted display string, cell type, cached formula, origin reference (`A1`).
  - `HeaderMetadataSchema` / `HeaderMetadata`: Detected row index, confidence score (0-1), original header strings, sanitized safe keys.
  - `ColumnMetadataSchema` / `ColumnMetadata`: Safe key, original name, column index.
  - `SheetModelSchema` / `SheetModel`: Sheet ID, name, headers, columns, clean row records (`Record<SafeIdentifier, unknown>`), row/column counts, bounds.
  - `WorkbookModelSchema` / `WorkbookModel`: Multi-sheet normalized representation, active sheet index, file metadata.
- **`src/profile.ts`**:
  - `InferredDataTypeSchema` / `InferredDataType`: `'number' | 'currency' | 'percent' | 'date' | 'category' | 'id' | 'boolean' | 'text'`.
  - `SemanticRoleSchema` / `SemanticRole`: `'dimension' | 'measure' | 'time' | 'identifier'`.
  - `NumericStatsSchema` / `NumericStats`: `min`, `max`, `mean`, `median`, `sum`, `variance`, `stdDev`.
  - `CategoryFrequencySchema`: Categorical value distributions with percentage.
  - `ColumnProfileSchema` / `ColumnProfile`: Deep statistical profile with strictly capped `sampleValues` (max 5 items, max 40 chars).
  - `SheetProfileSchema` / `SheetProfile`: Aggregated sheet profile with recommended dimensions, measures, and time columns.
- **`src/spec.ts`**:
  - `DashboardSpecSchema` / `DashboardSpec`: Versioned JSON specification (`version: '1.0'`), responsive 12-column grid layout, filter specifications, theme, and widget array.
  - `WidgetSpecSchema` / `WidgetSpec`: **Discriminated union** on `type` supporting:
    1. `kpi`: Measure, aggregation (`sum`, `avg`, `count`, etc.), comparison target/previous values, display formatting.
    2. `line`: Time dimension, measures, granularity (`day`, `month`, `year`), series colors and styles.
    3. `bar`: Dimension, measures, aggregation, orientation, stacked, sort order, category limits.
    4. `donut`: Dimension, measure, inner radius, max slices.
    5. `table`: Columns, pagination (max 100), sortable, searchable.
    6. `pivot`: Row dimensions, column dimensions, pivot measures, subtotals, grand totals.
- **`src/template.ts`**:
  - `SchemaFingerprintSchema` / `SchemaFingerprint`: 64-character SHA-256 hash of normalized column names and expected types.
  - `TemplateSchema` / `Template`: Packaged dashboard template with metadata, category, fingerprint, and spec.
- **`src/drift.ts`**:
  - `DriftReportSchema` / `DriftReport`: Details differences between template fingerprint and uploaded sheet (`matchedColumns`, `missingColumns`, `addedColumns`, `typeMismatches`, `suggestedRemappings`, `overallConfidence`).
- **`src/query.ts`**:
  - `QueryPlanSchema` / `QueryPlan`: Structured query specification for DuckDB-WASM (dimensions, aggregations, select, filters with operators `eq`, `in`, `between`, etc., ordering, limit, offset).
  - `QueryResultSchema` / `QueryResult`: Columns, row records, row count, execution time in milliseconds.
- **`src/api.ts`**:
  - `SpecRefinementRequestSchema` / `SpecRefinementResponseSchema`: LLM prompt + metadata refinement payloads.
  - `ShareTokenSchema`: High-entropy unguessable token (>= 22 chars / 128-bit entropy).
  - `CreateShareLinkRequestSchema` / `CreateShareLinkResponseSchema` / `GetShareLinkResponseSchema`.
  - `AskYourDataRequestSchema` / `AskYourDataResponseSchema`: Natural language question answering payloads.

---

## 4. Downstream Guidance for Builder Sub-Agents

1. **`ingest-engineer` (Phase 1)**:
   - Target models: `WorkbookModel`, `SheetModel`, `CellModel`, `HeaderMetadata`, `ColumnMetadata`.
   - Ensure header sanitization generates keys strictly compliant with `SafeIdentifierSchema`.
   - Never evaluate formulas; populate `CellModel.raw` from `cell.v`.
   - Enforce zip-bomb and cell count limits defined in `docs/THREAT_MODEL.md`.

2. **`fixtures-engineer` (Phase 1)**:
   - Generate test workbooks covering diverse cases: clean tables, messy multi-header rows, merged cells, currency formats, ISO and Excel serial dates.
   - Supply adversarial test workbooks to verify prototype key rejection and formula injection neutralization.

3. **`profiling-engineer` (Phase 2 & Phase 4)**:
   - Produce `ColumnProfile` and `SheetProfile` objects validating against `ColumnProfileSchema`.
   - Strict requirement: ensure `sampleValues` are capped to <= 5 items and truncated to <= 40 chars with formula prefixes stripped.
   - Implement `SpecGen` heuristics mapping profiles to valid `DashboardSpec` widgets.
   - Implement drift engine emitting `DriftReport`.

4. **`query-engineer` (Phase 3 & Phase 5)**:
   - Accept `QueryPlan` schemas and compile to DuckDB-WASM SQL.
   - Enforce AST-level single `SELECT` parser validation and identifier allowlists.
   - Return structured `QueryResult` matching `QueryResultSchema`.

5. **`frontend-engineer` (Phase 3 & Phase 4)**:
   - The total renderer must consume `DashboardSpecSchema`.
   - Implement graceful error boundaries / error fallback cards for unknown or broken widgets.
   - Strictly avoid `dangerouslySetInnerHTML`.

6. **`backend-engineer` (Phase 4, Phase 5, Phase 6)**:
   - Validate all API endpoints using schemas in `src/api.ts`.
   - Enforce rate limiting, Supabase RLS deny-by-default, and >= 128-bit share tokens.

---

## 5. Verification & Acceptance Results

Run the verification pipeline to confirm all criteria:

```bash
# Verify contracts package locally
pnpm --filter @unsheet/contracts build
pnpm --filter @unsheet/contracts test

# Verify entire monorepo
pnpm verify
```

### Verification Summary
- **ESLint**: 0 errors, 0 warnings across all workspaces.
- **Strict Typecheck**: `tsc --noEmit` passed across all 4 workspaces (`contracts`, `engine`, `fixtures`, `web`).
- **Tests**: 28 passed across 5 test suites (24 tests in contracts validating happy paths, boundary rejection, prototype pollution, formula injection, and discriminated unions).
- **Build**: All packages compiled cleanly.
- **Secret Scan**: Clean.
- **Audit**: Zero high/critical vulnerabilities.
