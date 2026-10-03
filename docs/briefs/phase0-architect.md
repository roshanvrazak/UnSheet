# Task Brief: Phase 0 - Software Architecture & Contracts

## Agent
`architect`

## Goal
Establish the foundational specification documents (`docs/SPEC.md`, `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`) and author the complete, authoritative `packages/contracts` package with comprehensive Zod schemas, inferred TypeScript types, and contract tests.

## Owned Paths
- `docs/SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/THREAT_MODEL.md`
- `packages/contracts/**`

## Required Contracts to Define in `packages/contracts`
1. `WorkbookModel` / `SheetModel` / `CellModel`: Normalized representation of parsed spreadsheets (table of clean rows/columns, typed values, header metadata, cell origin).
2. `ColumnProfile`: Statistical and semantic profile for each column (name, inferred data type: number, currency, percent, date, category, id, boolean, text; role: dimension, measure, time, identifier; stats: nullCount, distinctCount, min, max, mean, topValues; sampleValues capped at 5 items <=40 chars).
3. `DashboardSpec`: Versioned JSON spec (e.g. `version: "1.0"`), title, layout, filter definitions, and an array of widgets (discriminated union on `type`: KPI, LineChart, BarChart, DonutChart, Table, PivotTable).
4. `Template`: Spec + schema fingerprint (hash of normalized column names and expected types).
5. `DriftReport`: Details schema changes between original template and newly uploaded sheet (missing columns, added columns, changed types, similarity confidence).
6. `QueryPlan` / `QueryResult`: Structured representation of in-browser queries against normalized data.
7. API Payloads: Payloads for LLM spec refinement request/response, share link create/fetch, ask-your-data requests.

## Specifications & Requirements
- `docs/SPEC.md`: Product vision, pipeline (Parse -> Normalise -> Profile -> SpecGen -> Validate -> Edit -> Render -> Template -> Drift -> Ask -> Share), privacy-first guarantees.
- `docs/ARCHITECTURE.md`: High-level system architecture, client-side processing pipeline, data isolation model, and a comprehensive Mermaid diagram.
- `docs/THREAT_MODEL.md`: Full STRIDE threat model mapped directly to the 14 mandatory mitigations from Section 4 of the project prompt.
- `packages/contracts`:
  - `package.json`: exports typescript files, name `@unsheet/contracts`, only dependency is `zod`.
  - `tsconfig.json`: strict TypeScript (`noUncheckedIndexedAccess: true`).
  - Unit/Contract tests verifying schemas with valid and invalid inputs using Vitest.

## Acceptance Criteria
- All schemas validate valid test fixtures and strictly reject invalid / oversized / malformed structures.
- Discriminated union for `DashboardSpec` widgets correctly rejects unknown widget types.
- TypeScript compiler passes with zero errors on strict mode.
- Contract tests pass with 100% coverage on schemas.

## Handoff
Write `docs/handoffs/phase0-architect.md` describing contracts exported, schemas, design decisions, and how to verify.
