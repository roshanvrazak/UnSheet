# Task Brief: Phase 2 Profile & Generate Spec

**Agent**: `profiling-engineer`  
**Branch**: `agent/profiling/phase2-profile-specgen`  
**Owned Paths**:
- `packages/engine/src/profile/**`
- `packages/engine/src/specgen/**`
- `packages/engine/src/drift/**`
- `packages/engine/src/index.ts`
- `packages/engine/test/profile/**`
- `packages/engine/test/specgen/**`
- `packages/engine/test/drift/**`
- `packages/engine/test/benchmarks/**`

## Goal
Implement the Profiling, Deterministic Dashboard Spec Generation, and Schema Drift Detection engines in `@unsheet/engine`, fully conforming to `@unsheet/contracts` with zero DOM dependencies.

## Detailed Requirements

### 1. Column & Sheet Profiling (`packages/engine/src/profile/`)
- **Type Inference (`inference.ts`)**:
  - Evaluate non-null values for each column across candidate types with statistical scoring (target type candidate with >= 80% confidence):
    - `number`: integers, floats, scientific notation
    - `currency`: currency prefixes/suffixes (`$`, `€`, `£`, `¥`, `₹`), accounting parentheses negatives `(1,234.50)` -> `-1234.50`, ISO codes
    - `percent`: numeric strings ending with `%` (e.g. `12.5%`) or numbers formatted as percentages
    - `date`: ISO 8601 strings, US formats `MM/DD/YYYY`, UK formats `DD/MM/YYYY`, named month formats `15-Oct-2023`, Excel serial numbers (1900 system [range ~25,000..60,000] and 1904 system)
    - `boolean`: `true`/`false`, `1`/`0` (when column is boolean-only), `yes`/`no`
    - `id`: alphanumeric identifiers with high uniqueness (>= 0.90 uniqueness ratio, pattern `^[A-Za-z0-9_-]+$`)
    - `category`: low-cardinality discrete strings (distinct count <= 50 or uniqueness ratio <= 0.20)
    - `text`: freeform unstructured text
  - Invariant: confidence score for inferred type must be between 0.0 and 1.0.
- **Semantic Role Assignment (`roles.ts`)**:
  - `time`: if inferred type is `date` or column name indicates time (`year`, `quarter`, `month`, `date`, `timestamp`)
  - `measure`: continuous aggregatable numeric values (`number`, `currency`, `percent`)
  - `identifier`: high-uniqueness keys, UUIDs, SKUs, primary keys
  - `dimension`: discrete categoricals, status flags, categories, low-cardinality values
- **Statistical Summaries & Capped Samples (`stats.ts`)**:
  - Compute finite numeric stats: `min`, `max`, `sum`, `mean`, `median`, `variance`, `stdDev` (`z.number().finite()`).
  - Calculate `distinctCount`, `nullCount`, `totalCount`, `uniquenessRatio`.
  - Top category frequencies: up to 50 items with `value` (sanitized against formula injection `=, +, -, @, \t, \r, \n, |`), `count`, `percentage`.
  - Sample values (`sampleValues`): max 5 representative non-null values, max 40 chars each, sanitized against formula injection (`SampleValuesArraySchema`).
- **Relational Join Detection (`joins.ts`)**:
  - Inspect pairs of sheets in a `WorkbookModel`. Identify candidate join keys where column names match or share a stem (e.g. `customer_id` and `id`), have compatible types, and value set overlap ratio exceeds 50%.
- **Output Models**:
  - `profileSheet(sheet: SheetModel): SheetProfile` (identifies `recommendedDimensions`, `recommendedMeasures`, `recommendedTimeColumn`, `primaryKeyCandidate`).
  - `profileWorkbook(workbook: WorkbookModel): SheetProfile[]` (or workbook profile).

### 2. Deterministic Spec Generation (`packages/engine/src/specgen/`)
- Pure algorithmic rules engine mapping `SheetProfile` to a complete `DashboardSpec` conforming to `DashboardSpecSchema`:
  - **KPI Cards**: 1 to 4 KPI widgets for primary measures (`sum` or `avg` or `count`) positioned at row 0 (e.g. `w: 3, h: 2` or `w: 4, h: 2`).
  - **Time Series Line Chart**: If `recommendedTimeColumn` and at least one measure exist, generate a `line` chart showing measure over time (e.g. `w: 8, h: 5`).
  - **Composition / Donut Chart**: If a low-cardinality dimension exists (cardinality between 2 and 6, e.g. `status` or `department`), generate a `donut` chart (e.g. `w: 4, h: 5`).
  - **Breakdown Bar Chart**: If a dimension and measure exist, generate a `bar` chart (e.g. `w: 6, h: 5`).
  - **Record Table**: Tabular view of top dimensions and measures (e.g. `w: 12, h: 6`).
  - **Pivot Table**: If at least 2 dimensions and 1 measure exist, generate a `pivot` table.
  - **Global Filters**: Auto-populate filters for top 1-3 categorical dimensions (`select` or `multi-select`) and date range (`date-range`) if time column exists.
  - **Grid Layout Rules**:
    - 12-column grid.
    - Strictly enforce `pos.x + pos.w <= 12`.
    - No overlapping widget positions.
    - Max 50 widgets (`DashboardSpecSchema` bound).
  - Validation: Every generated spec must pass `DashboardSpecSchema.parse()`.

### 3. Schema Drift Detection (`packages/engine/src/drift/`)
- `detectDrift(templateSpec: DashboardSpec, newSheetProfile: SheetProfile): DriftReport`:
  - Identify `matchedColumns`: existing columns in spec with same type in new sheet.
  - Identify `missingColumns`: columns bound in spec widgets that do not exist in new sheet.
  - Identify `addedColumns`: columns in new sheet not present in template spec.
  - Identify `typeMismatches`: column key matches but inferred type differs, indicating whether coerceable.
  - `suggestedRemappings`: For missing columns, calculate similarity (Levenshtein distance / token overlap / same type) against added columns. Suggest mapping if confidence >= 0.60.
  - Compute `overallConfidence` and `hasBreakingChanges` (true if any widget has unmapped required columns).
  - Validation: Output must pass `DriftReportSchema.parse()`.

### 4. Accuracy Benchmarks & Invariant Testing
- In `packages/engine/test/benchmarks/accuracy.test.ts`:
  - Benchmark type inference across the 28 fixtures:
    - Serial dates (08 & 09) infer as `date` with confidence >= 0.90.
    - Currencies (11) infer as `currency` with confidence >= 0.90.
    - Percentages (12) infer as `percent` with confidence >= 0.90.
    - Multi-sheet join keys (15) correctly detect join candidate.
  - Assert column typing accuracy >= 95%.
- In `packages/engine/test/specgen/specgen.test.ts`:
  - Fast-check property test: arbitrary valid `SheetProfile` generates a spec that parses cleanly with `DashboardSpecSchema.parse()`.
  - Grid invariants: all widgets satisfy `x + w <= 12`, non-overlapping bounding boxes.
- In `packages/engine/test/drift/drift.test.ts`:
  - Test renaming scenarios, type change scenarios, and missing column detection.

## Verification
- `pnpm --filter @unsheet/engine test` (all tests passing)
- Line coverage >= 90%, branch coverage >= 85%
- `pnpm verify` (lint + typecheck + test + build + secret scan + audit must pass 100%)

## Handoff
Write report to `docs/handoffs/phase2-profiling-engineer.md` and commit changes to `agent/profiling/phase2-profile-specgen`.
