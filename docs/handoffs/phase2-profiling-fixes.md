# Phase 2 Profiling, SpecGen, & Drift Remediation Handoff

## 1. Executive Summary

This handoff documents the implementation and verification of the Phase 2 Profiling, SpecGen, and Drift remediation fixes per the Phase 2 remediation mandate and findings from the Phase 2 independent reviews (`security-phase2.md`, `code-review-phase2.md`, `adversarial-phase2.md`).

All fixes were implemented and verified on branch `agent/profiling/phase2-fixes`. Across the entire monorepo, `pnpm verify` succeeded with 100% pass rate:
- **Linting**: 0 ESLint errors across all workspaces.
- **Typechecking**: Strict `tsc --noEmit` passed across all workspace packages (`@unsheet/contracts`, `@unsheet/engine`, `@unsheet/fixtures`, `@unsheet/web`).
- **Unit & Adversarial Tests**: 25/25 test files passed, 460/460 tests passed (including all 19 engine test files and 178 engine tests).
- **Build**: All workspaces built cleanly.
- **Secret Scan**: Clean (0 detected secrets).
- **Audit**: High-severity clean.

---

## 2. Remediated Components & Technical Details

### 1. SpecGen Identifier Clamping & Contract Defense (`ADV-P2-13`)
- **Target**: `packages/engine/src/specgen/specgen.ts`
- **Fix**: All dynamic widget IDs (`kpi_${key}`, `bar_${key}`, `line_trend_${key}`, `donut_breakdown_${key}`) and filter IDs (`filter_${key}`) are strictly clamped to at most 128 characters using `.slice(0, 128) as SafeIdentifier`.
- **Guarantee**: Even if a source column identifier approaches the maximum allowed `SafeIdentifier` length (128 characters), prepending widget prefixes cannot overflow the 128-character schema boundary or crash `DashboardSpecSchema.parse()`.

### 2. SpecGen Title Fallback Robustness (`ADV-P2-14`)
- **Target**: `packages/engine/src/specgen/specgen.ts`
- **Fix**: Replaced `options?.title || fallback` with `options?.title?.trim() || fallback`.
- **Guarantee**: Passing whitespace-only strings (e.g., `'   '`) as `options.title` trims to empty and gracefully falls back to `${formatTitle(profile.sheetName, 100)} Dashboard`, preventing contract crashes against `TitleSchema` (which rejects whitespace-only titles).

### 3. Recommendation Deduplication in SpecGen (`ADV-P2-15`)
- **Target**: `packages/engine/src/specgen/specgen.ts`
- **Fix**: Wrapped recommended measures and dimensions in `Array.from(new Set(...))` prior to widget and filter generation:
  ```ts
  const measures = Array.from(new Set(rawMeasures));
  const dimensions = Array.from(new Set(rawDimensions));
  ```
- **Guarantee**: Duplicate entries in `profile.recommendedMeasures` or `recommendedDimensions` are deduplicated before layout generation, preventing redundant widget creation and duplicate widget ID collisions.

### 4. Levenshtein Quadratic Complexity & ReDoS Defense (`SEC-P2-07`, `ADV-P2-11`)
- **Target**: `packages/engine/src/drift/similarity.ts`
- **Fix**: Truncated input strings to 128 characters (`a.slice(0, 128)`, `b.slice(0, 128)`) at the entry points of both `levenshteinDistance` and `calculateColumnSimilarity`.
- **Guarantee**: Since valid column keys conform to `SafeIdentifier` (<= 128 characters), edit distance operations are bounded to at most $128 \times 128 = 16,384$ iterations, completely eliminating quadratic CPU exhaustion from adversarial strings (e.g. 2,000+ characters).

### 5. LLM Profile Sanitization Helpers (`REV-P2-05`)
- **Target**: `packages/engine/src/profile/llm.ts`, `packages/engine/src/profile/index.ts`, `packages/engine/src/index.ts`
- **Fix**: Implemented `toLLMColumnProfile` and `toLLMSheetProfile`:
  - `toLLMColumnProfile(col: ColumnProfile): LLMColumnProfile` strips raw category frequency breakdowns (`topValues`) to prevent prompt injection and cell-level data exfiltration to external LLMs.
  - `toLLMSheetProfile(sheet: SheetProfile): LLMSheetProfile` maps all column profiles through `toLLMColumnProfile`.
  - Re-exported from both `packages/engine/src/profile/index.ts` and `packages/engine/src/index.ts`, covered with unit tests in `packages/engine/src/index.test.ts`.

### 6. Prototype Pollution & Null-Prototype Safety (`ADV-P2-08`, `ADV-P2-09`)
- **Targets**: `packages/engine/src/profile/inference.ts`, `packages/engine/src/profile/stats.ts`, `packages/engine/src/profile/joins.ts`
- **Fixes**:
  - Replaced all raw `String(val)` conversions with `safeToString(val)` from `src/normalise/cell.ts`.
  - Handled `Object.create(null)` cell values gracefully without throwing unhandled `TypeError: Cannot convert object to primitive value`.
  - Enforced `SheetProfileSchema` rejection of prototype poisoning identifiers (`__proto__`, `constructor`, `prototype`) in `sheetName`.

### 7. Non-Finite String and False Date Inference Hardening (`ADV-P2-04`, `ADV-P2-07`)
- **Target**: `packages/engine/src/profile/inference.ts`
- **Fixes**:
  - Guarded numeric string parsing with `Number.isFinite(Number(cleaned))` rather than `!Number.isNaN`, correctly rejecting strings like `"Infinity"` and `"-Infinity"` from false numeric classification.
  - Excluded monetary and quantitative keyword columns (`budget`, `cost`, `unit`) from Excel serial date inference heuristics, preventing columns like `planned_budget` from being misclassified as dates.

### 8. Relational Joins Optimization & Schema Alignment (`REV-P2-03`, `ADV-P2-12`)
- **Targets**: `packages/engine/src/profile/joins.ts`, `packages/engine/src/profile/workbook.ts`
- **Fixes**:
  - Pre-filtered column pairs using identifier compatibility and type compatibility before computing set intersections.
  - Executed set intersection over the smaller set.
  - Aligned output directly with `@unsheet/contracts` `JoinCandidateSchema` (`sourceSheet`, `targetSheet`, `sourceColumn`, `targetColumn`, `sampleMatches`) and `WorkbookProfileSchema` (`crossSheetJoins`), while providing backward compatibility property getters (`joinCandidates`, `fromSheet`, `toSheet`, etc.).

---

## 3. Automated Test Verification Summary

1. **Adversarial Test Suite (`packages/engine/test/adversarial/phase2_adversarial.test.ts`)**:
   - `ADV-P2-01` through `ADV-P2-17`: 17/17 tests passing.
   - Assertions updated to verify secured behavior (clamped IDs, trimmed title fallbacks, deduplicated widgets, non-finite string rejection, bounded Levenshtein).
   - Removed unused imports and resolved all lint warnings.

2. **Profiling Unit & Accuracy Tests**:
   - `test/profile/profile.test.ts`: 15/15 tests passing.
   - `test/benchmarks/accuracy.test.ts`: 6/6 tests passing (>= 95% column inference accuracy across 28 golden fixtures).
   - `test/drift/drift.test.ts`: 7/7 tests passing.
   - `test/specgen/specgen.test.ts`: 7/7 tests passing.

3. **Workspace Full Verification (`pnpm verify`)**:
   - Step 1/6: ESLint across all workspaces -> 0 errors.
   - Step 2/6: `tsc --noEmit` across all workspaces -> 0 errors.
   - Step 3/6: Vitest across all workspaces -> 25 test files, 460 tests passed.
   - Step 4/6: Build across all workspaces -> 4 workspace packages built successfully.
   - Step 5/6: Secret scanning -> 0 secrets detected.
   - Step 6/6: Dependency audit -> 0 high/critical vulnerabilities.
