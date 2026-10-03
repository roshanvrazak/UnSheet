# Task Brief: Phase 2 Profiling, SpecGen & Drift Remediation

**Agent**: `profiling-engineer`  
**Branch**: `agent/profiling/phase2-fixes`  
**Owned Paths**:
- `packages/engine/src/profile/**`
- `packages/engine/src/specgen/**`
- `packages/engine/src/drift/**`
- `packages/engine/src/index.ts`
- `packages/engine/test/**`

## Goal
Remediate all findings from the Phase 2 reviews (`security-phase2.md`, `code-review-phase2.md`, and `adversarial-phase2.md`).

## Requirements

### 1. Verification & Compiler Fixes
- **Unused Imports Removal (`REV-P2-01`)**:
  - In `packages/engine/test/adversarial/phase2_adversarial.test.ts`, remove unused imports (`DriftReportSchema`, `DashboardSpec`, `ColumnProfile`, `parseNumericValue`, `profileWorkbook`, `calculateColumnSimilarity`, `isCoercible`) so `pnpm run lint` passes with 0 errors.

### 2. Robustness & Crash Safety
- **Null-Prototype Safe String Conversion (`REV-P2-01`, `ADV-P2-08`, `SEC-P2-04`)**:
  - In `packages/engine/src/profile/stats.ts`, `inference.ts`, and `joins.ts`, replace all raw `String(val)` calls on unknown cell values with `safeToString(val)` (import from `../normalise/cell.js`) so `Object.create(null)` values never throw `TypeError: Cannot convert object to primitive value`.
- **"Infinity" Number Inference Bug (`ADV-P2-04`)**:
  - In `packages/engine/src/profile/inference.ts`, replace `!Number.isNaN(Number(cleaned))` with `Number.isFinite(Number(cleaned))` so `"Infinity"` and `"-Infinity"` strings are not inferred as numeric measures.
- **Widget & Filter ID Length Cap (`ADV-P2-13`)**:
  - In `packages/engine/src/specgen/specgen.ts`, ensure all constructed widget IDs (`kpi_${key}`, `bar_${key}`) and filter IDs (`filter_${key}`) are clamped to at most 128 characters (`.slice(0, 128) as SafeIdentifier`) so long column keys do not violate `SafeIdentifierSchema` max length constraint.
- **Whitespace Title Fallback (`ADV-P2-14`)**:
  - In `packages/engine/src/specgen/specgen.ts`, use `options?.title?.trim() || fallback` so whitespace-only titles do not crash `TitleSchema`.
- **Deduplication of Measures in SpecGen (`ADV-P2-15`)**:
  - In `packages/engine/src/specgen/specgen.ts`, deduplicate `recommendedMeasures` and `recommendedDimensions` arrays before generating widgets to prevent duplicate widget IDs.

### 2. Algorithmic Optimization & Complexity Bounds
- **Combinatorial Join Search Optimization (`SEC-P2-01`, `REV-P2-04`, `REV-P2-06`)**:
  - In `packages/engine/src/profile/joins.ts`:
    - Pre-filter column pairs: only compare column pairs where names share a stem or have high naming compatibility, and candidate types are compatible (`id`, `category`, `number`, `text`).
    - Pre-compute column unique sets upfront once per sheet column instead of repeatedly mapping rows in nested loops.
    - Sample rows (up to 2,000 values) if sheet row count is large (> 2,000 rows) to keep join candidate evaluation under 100ms.
    - Avoid reciprocal duplicates: ensure each join pair $(A, B)$ is emitted in a canonical direction or deduplicated.
- **Levenshtein String Bounding (`SEC-P2-07`, `ADV-P2-11`)**:
  - In `packages/engine/src/drift/similarity.ts`, truncate input strings to 128 characters before executing the dynamic programming matrix.

### 3. Security, Privacy & Contract Adherence
- **LLM Profile Transformation Helper (`SEC-P2-02`)**:
  - In `packages/engine/src/profile/`, export `toLLMColumnProfile(col: ColumnProfile): LLMColumnProfile` and `toLLMSheetProfile(sheet: SheetProfile)` that strip `topValues` using `LLMColumnProfileSchema.parse(...)` so callers can safely prepare metadata for external LLM calls without leaking full category frequencies.
- **Formula Fallback Defense (`SEC-P2-06`)**:
  - In formula trigger sanitization, check both `val` and `val.trimStart()` to neutralize formula characters even when preceded by whitespace.
- **Official Contracts for Joins & Workbook Profiles (`REV-P2-03`)**:
  - In `packages/engine/src/profile/workbook.ts` and `joins.ts`, import and use `JoinCandidate` and `WorkbookProfile` from `@unsheet/contracts`.
  - Validate output with `WorkbookProfileSchema.parse(workbookProfile)`.
- **Generalized Heuristics (`REV-P2-02`)**:
  - In `packages/engine/src/profile/inference.ts`, generalize any brittle fixture-specific column name tokens into standard heuristics.

## Verification
- Run `pnpm --filter @unsheet/engine test` (all 18+ test files including `phase2_adversarial.test.ts` must pass).
- Verify code coverage: lines >= 90%, branches >= 85%.
- Run `pnpm verify` (all 6 steps passing 100%).

## Handoff
Write report to `docs/handoffs/phase2-profiling-fixes.md` and commit to `agent/profiling/phase2-fixes`.
