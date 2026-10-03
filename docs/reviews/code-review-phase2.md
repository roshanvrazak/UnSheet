# Independent Code Review: Phase 2 Deliverables

**Date**: 2026-10-04  
**Auditor**: Independent Code Reviewer (`code-reviewer`)  
**Target Workspaces & Deliverables**:
- Profiling Engine: [`packages/engine/src/profile/**`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile)
  - Column Profiler: [`packages/engine/src/profile/column.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/column.ts)
  - Statistical Computations: [`packages/engine/src/profile/stats.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/stats.ts)
  - Semantic Type Inference: [`packages/engine/src/profile/inference.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/inference.ts)
  - Sheet Profiler: [`packages/engine/src/profile/sheet.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/sheet.ts)
  - Workbook Profiler & Joins: [`packages/engine/src/profile/workbook.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/workbook.ts), [`packages/engine/src/profile/joins.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/joins.ts)
- Dashboard Spec Generator: [`packages/engine/src/specgen/**`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/specgen)
  - Rule-Based Spec Synthesis: [`packages/engine/src/specgen/specgen.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/specgen/specgen.ts)
- Schema Drift Engine: [`packages/engine/src/drift/**`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/drift)
  - String & Token Similarity: [`packages/engine/src/drift/similarity.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/drift/similarity.ts)
  - Type Coercibility: [`packages/engine/src/drift/coercion.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/drift/coercion.ts)
  - Drift Detection Core: [`packages/engine/src/drift/drift.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/drift/drift.ts)
- Test Suites & Accuracy Benchmarks: [`packages/engine/test/**`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test)
  - Profiling Unit & Edge Tests: [`packages/engine/test/profile/profile.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/profile/profile.test.ts)
  - SpecGen Determinism & Geometry Tests: [`packages/engine/test/specgen/specgen.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/specgen/specgen.test.ts)
  - Drift & Coercion Tests: [`packages/engine/test/drift/drift.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/drift/drift.test.ts)
  - Semantic Accuracy Benchmark: [`packages/engine/test/benchmarks/accuracy.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/benchmarks/accuracy.test.ts)
  - Adversarial Red-Team Suite: [`packages/engine/test/adversarial/phase2_adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/phase2_adversarial.test.ts)

---

## 1. Executive Summary & Audit Verdict

### Overall Verdict: **CONDITIONAL PASS** (Remediations Required Prior to Phase 3 UI Integration)

Phase 2 establishes three headless capabilities for Unsheet: an automated statistical and semantic column profiler, a deterministic rule-based dashboard specification synthesizer, and a schema drift detection engine comparing evolving sheet layouts.

The implementation exhibits rigorous engineering quality in its core algorithms:
1. **Accurate Numerical Profiling**: Statistics calculations in [`packages/engine/src/profile/stats.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/stats.ts) handle floating-point edge cases, negative numbers, single-value sets, and null-dense distributions correctly. Two-pass sample variance using Bessel's correction $(N-1)$ is mathematically sound, and median calculation cleanly partitions even/odd sets.
2. **Deterministic Spec Synthesis & Geometry Guarantee**: The rule-based spec generator in [`packages/engine/src/specgen/specgen.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/specgen/specgen.ts) strictly enforces a 12-column grid layout, guaranteeing non-overlapping widget boundaries ($pos.x + pos.w \le 12$) through deterministic column allocation algorithms verified by automated property checks. Generated specs strictly bind widget encodings (`measureCol`, `dimensionCol`, `seriesCol`) to verified profile columns and produce schemas that fully validate against `DashboardSpecSchema`.
3. **Drift Detection & Coercion Matrices**: The schema drift engine combines dynamic-programming Levenshtein distance ($O(\min(N, M))$ memory optimization) with token-based Jaccard similarity to accurately detect renamed columns above a 0.60 threshold. Breaking changes (dropped columns, non-coercible type alterations) are cleanly distinguished from non-breaking additions and safe coercions.
4. **Test & Accuracy Benchmarks**: 100% test pass rate across 24 test suites (440 total tests). Engine code coverage stands at **95.59% line coverage** (target $\ge 90\%$), **88.74% branch coverage** (target $\ge 85\%$), and **100% function coverage**. Semantic accuracy benchmarks against the 28 golden fixture datasets achieve **100% accuracy** (341/341 columns matched).

However, an exhaustive independent audit identified **1 Critical CI/lint pipeline blocker**, **1 High-severity robustness defect**, **3 Medium-severity architecture/algorithmic items**, and **4 Low-severity hygiene items**:

1. **Verification Pipeline Blocker (CRITICAL - REV-P2-01)**:
   [`packages/engine/test/adversarial/phase2_adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/phase2_adversarial.test.ts#L7-L27) contains 7 unused imports (`DriftReportSchema`, `DashboardSpec`, `ColumnProfile`, `parseNumericValue`, `profileWorkbook`, `calculateColumnSimilarity`, `isCoercible`), causing `pnpm run lint` and `./scripts/verify.sh` to fail with ESLint `@typescript-eslint/no-unused-vars` errors.
2. **Unhandled `TypeError` Crash on Null-Prototype Objects in Profiler (HIGH - REV-P2-02)**:
   [`profile/stats.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/stats.ts#L174, #L244), [`inference.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/inference.ts#L395), and [`joins.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/joins.ts#L89, #L101) directly execute raw `String(val)` on cell values. As discovered in Phase 1 red-team testing (ADV-P1-07), cell values containing `Object.create(null)` throw an unhandled `TypeError: Cannot convert object to primitive value`. While Phase 1 implemented `safeToString()` in `packages/engine/src/normalise/cell.ts`, this helper was never imported into the `profile` module.
3. **Cartesian $O(S^2 \cdot C^2 \cdot R)$ Complexity in Join Discovery (MEDIUM/HIGH - REV-P2-03)**:
   In [`packages/engine/src/profile/joins.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/joins.ts#L84-L112), nested loops across sheet pairs repeatedly extract column arrays `sheetB.rows.map(...)`, construct `Set` instances, and execute `inferColumnType(valuesB)` for every column in sheet A, resulting in redundant operations instead of pre-computing column sets and types once upfront.
4. **Heuristic Overfitting and Brittle Column Token Matching (MEDIUM - REV-P2-04)**:
   In [`packages/engine/src/profile/inference.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/inference.ts#L65, #L103, #L130-131, #L145, #L380, #L419-421), type inference hardcodes fixture-specific tokens (`caf_co_t_eur` for Fixture 18, `reading_value` and `national_id` for Fixtures 07/13, `col_1` for IDs, `col_4` for categories, and a blanket bypass for `expense_category`). Generic user columns named `col_1` or `col_4` will be forcibly misclassified.
5. **Monorepo Contract Bypass for Workbook Profiles & Joins (MEDIUM - REV-P2-05)**:
   `WorkbookProfile` and `JoinCandidate` are defined solely as internal TypeScript interfaces in [`packages/engine/src/profile/workbook.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/workbook.ts#L5-L10) and [`joins.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/joins.ts#L4-L11). They lack corresponding Zod schemas in `packages/contracts/src/profile.ts`, preventing validation across worker boundaries or in downstream UI consumers.

### Evaluation Scorecard

| Evaluation Dimension | Rating | Summary Assessment |
|---|---|---|
| **1. TypeScript Strictness** | **A** | Zero `any` in `src/` and `test/`. Strict flags enabled (`noUncheckedIndexedAccess`, `strict: true`). Both `src/**/*` and `test/**/*` included in `tsconfig.json`. Single minor string assertion (`'id' as SafeIdentifier`). |
| **2. Profiling Correctness** | **B+** | Statistical calculations mathematically sound (two-pass variance, Bessel correction, median, distinct ratio). High-severity gap: raw `String()` calls will crash with unhandled `TypeError` on null-prototype objects. Minor gap: serial date heuristic restricted to specific keywords. |
| **3. Spec Generator Determinism** | **A** | 100% deterministic rule-based layout synthesis. Enforces $x + w \le 12$, zero grid collisions (verified via property tests), strictly maps widget measure/dimension/series to existing profiled columns, and passes `DashboardSpecSchema.parse()`. |
| **4. Drift Detection Correctness** | **A** | Memory-optimized Levenshtein distance ($O(\min(N,M))$ memory), token Jaccard similarity with prefix matching, comprehensive coercion transition matrix. Clean distinction between breaking and non-breaking modifications. |
| **5. Test Coverage & Accuracy** | **A-** | Pipeline blocker: 7 unused imports break ESLint in newly added adversarial test suite. Overall engine line coverage: **95.59%** (target $\ge 90\%$), branch coverage: **88.74%** (target $\ge 85\%$). Golden benchmark achieves **100% accuracy** (341/341 columns) on 28 fixture datasets. |
| **6. Algorithmic Efficiency & Memory** | **B+** | Single-pass row aggregation in column profiler. $O(\min(N,M))$ auxiliary space in Levenshtein. Gap: $O(S^2 \cdot C^2 \cdot R)$ repeated row array extractions and redundant type inference invocations during join candidate search. |

---

## 2. Findings Matrix

| Finding ID | Severity | Category | Target Location | Description |
|---|---|---|---|---|
| **REV-P2-01** | **CRITICAL** | CI / Linting | [`packages/engine/test/adversarial/phase2_adversarial.test.ts#L7-L27`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/phase2_adversarial.test.ts#L7-L27) | 7 unused imports (`DriftReportSchema`, `DashboardSpec`, `ColumnProfile`, `parseNumericValue`, `profileWorkbook`, `calculateColumnSimilarity`, `isCoercible`) trigger ESLint `@typescript-eslint/no-unused-vars` errors, failing `pnpm run lint` and `./scripts/verify.sh`. |
| **REV-P2-02** | **HIGH** | Robustness / Crash Safety | [`packages/engine/src/profile/stats.ts#L174, #L244`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/stats.ts#L174), [`inference.ts#L395`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/inference.ts#L395), [`joins.ts#L89, #L101`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/joins.ts#L89) | Direct calls to `String(val)` throw uncaught `TypeError: Cannot convert object to primitive value` when values are null-prototype objects (`Object.create(null)`). Bypasses Phase 1 `safeToString()` safeguard. |
| **REV-P2-03** | **MEDIUM** | Performance / Big-O | [`packages/engine/src/profile/joins.ts#L84-L112`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/joins.ts#L84-L112) | In `findJoinCandidates()`, the inner loop repeatedly maps `sheetB.rows`, instantiates a `Set`, and executes `inferColumnType(valuesB)` for every column in sheet A ($O(\text{Cols}_A \times \text{Cols}_B \times \text{Rows})$) instead of pre-computing column sets and types once per sheet. |
| **REV-P2-04** | **MEDIUM** | Fragility / Heuristics | [`packages/engine/src/profile/inference.ts#L65, #L103, #L130-131, #L145, #L380, #L419-421`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/inference.ts) | Brittle keyword overfitting designed to satisfy specific test fixtures (e.g., `'caf_co_t_eur'`, `'reading_value'`, `'national_id'`, `'col_1'`, `'col_4'`, blanket bypass on `'expense_category'`). Causes real-world false classifications. |
| **REV-P2-05** | **MEDIUM** | Contract Adherence | [`packages/engine/src/profile/workbook.ts#L5-L10`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/workbook.ts#L5-L10), [`joins.ts#L4-L11`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/joins.ts#L4-L11) | `WorkbookProfile` and `JoinCandidate` are defined solely as ad-hoc engine interfaces and lack Zod contract schemas in `packages/contracts/src/profile.ts`, preventing boundary validation. |
| **REV-P2-06** | **LOW** | Heuristics / Coverage | [`packages/engine/src/profile/inference.ts#L320-L328`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/inference.ts#L320-L328) | Serial date detection (numbers in range 23,000..65,000) requires header names to match `/serial|date|timestamp|launch|planned/i`. Common production column names like `created`, `updated`, `due`, `deadline`, `expires`, `shipped` will be classified as raw `number`. |
| **REV-P2-07** | **LOW** | Correctness / Deduplication | [`packages/engine/src/profile/joins.ts#L77-L80`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/joins.ts#L77-L80) | `findJoinCandidates()` checks ordered sheet pairs $(i, j)$ with $i \ne j$, emitting both `(SheetA -> SheetB)` and `(SheetB -> SheetA)` reciprocal duplicates when join overlap exceeds threshold. |
| **REV-P2-08** | **LOW** | TypeScript Strictness | [`packages/engine/src/specgen/specgen.ts#L169`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/specgen/specgen.ts#L169) | Direct unchecked type assertion `'id' as SafeIdentifier` bypasses `SafeIdentifierSchema.safeParse()`. |
| **REV-P2-09** | **LOW** | Code Cleanliness / DRY | [`packages/engine/src/profile/stats.ts#L250-L253`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/stats.ts#L250-L253) | Formula sanitization for categorical distribution values re-implements leading quote prefixing locally rather than reusing centralized sanitization utilities from `packages/engine/src/normalise/sanitise.ts`. |

---

## 3. Detailed Audit by Category

### Category 1: TypeScript Strictness & Compiler Configuration

#### 1. Compiler Configuration ([`packages/engine/tsconfig.json`](file:///home/rvr/Work/basi/UnSheet/packages/engine/tsconfig.json))
- **Configuration Inspected**:
  ```json
  {
    "extends": "../../tsconfig.base.json",
    "include": ["src/**/*", "test/**/*"]
  }
  ```
- **Evaluation**: The Phase 1 finding (`REV-P1-02`), which noted that tests were omitted from compilation, has been remediated. Both `src/**/*` and `test/**/*` are now included under typechecking.
- **Flags Active from [`tsconfig.base.json`](file:///home/rvr/Work/basi/UnSheet/tsconfig.base.json)**:
  - `"strict": true`
  - `"noUncheckedIndexedAccess": true`
  - `"exactOptionalPropertyTypes": true`
  - `"noImplicitOverride": true`
- All package typechecks (`pnpm run typecheck`) pass cleanly with 0 errors across the entire repository.

#### 2. `any` and Unsafe Type Assertions Audit
- **Static Analysis of Source Code**:
  - `packages/engine/src/profile/**`: **0 instances** of `: any` or `as any`.
  - `packages/engine/src/specgen/**`: **0 instances** of `: any` or `as any`.
  - `packages/engine/src/drift/**`: **0 instances** of `: any` or `as any`.
  - `packages/engine/test/{profile,specgen,drift,benchmarks}/**`: **0 instances** of `: any` or `as any`.
- **Finding REV-P2-08 (Low - Unchecked Identifier Cast)**:
  In [`packages/engine/src/specgen/specgen.ts#L169`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/specgen/specgen.ts#L169):
  ```typescript
  return idCols[0]?.name ?? ('id' as SafeIdentifier);
  ```
  While `'id'` satisfies `^[a-z_][a-z0-9_]*$`, casting directly bypasses runtime verification. It should ideally be typed as a validated `SafeIdentifier` constant or parsed via `SafeIdentifierSchema.parse('id')`.

---

### Category 2: Profiling Correctness & Statistical Metrics

#### 1. Statistical Calculations ([`packages/engine/src/profile/stats.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/stats.ts))
- **Audited Metrics**:
  - **`min` / `max` / `sum`**: Computed in a single pass over finite numerical values (`!Number.isNaN(v) && Number.isFinite(v)`). Correctly ignores nulls, empty strings, and booleans.
  - **`mean`**: Safely guards against division by zero (`count === 0 ? null : sum / count`).
  - **`median`**: Sorts numbers using numerical comparator `(a, b) => a - b` (preventing alphabetical sorting bugs). Accurately splits even count sets `(sorted[mid - 1] + sorted[mid]) / 2` and odd count sets `sorted[mid]`.
  - **`variance` & `stdDev`**: Implements a two-pass algorithm. The second pass computes squared deviations $(v - \mu)^2$ against the verified mean. Uses Bessel's correction $(N - 1)$ for sample variance when $N > 1$, and returns `0` when $N = 1$, correctly handling degenerate sets. Returns `null` when $N = 0$.
  - **`distinctCount` & `uniquenessRatio`**: Tracks non-null distinct values in a `Set`. Correctly calculates `uniquenessRatio = distinctCount / totalRows`.
  - **`nullRatio`**: Accurately computes `nullCount / totalRows` (and returns `0` when total rows is 0).

#### 2. Robustness Gap: Raw `String()` on Null-Prototype Objects
- **Finding REV-P2-02 (High - Crash Vulnerability)**:
  In [`packages/engine/src/profile/stats.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/stats.ts#L174, #L244):
  ```typescript
  // stats.ts line 174:
  seen.add(String(v));
  // stats.ts line 244:
  const key = String(v);
  ```
  In [`packages/engine/src/profile/inference.ts#L395`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/inference.ts#L395):
  ```typescript
  strValues.push(String(v));
  ```
  In [`packages/engine/src/profile/joins.ts#L89, #L101`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/joins.ts#L89, #L101):
  ```typescript
  setA.add(String(v));
  ...
  setB.add(String(v));
  ```
  If an upstream pipeline step, plugin, or user object injects a cell with a null prototype (`Object.create(null)`), ECMAScript's `String(obj)` tries to call `obj.toString()` and throws:
  `TypeError: Cannot convert object to primitive value`.
  In Phase 1, `safeToString()` was created in [`packages/engine/src/normalise/cell.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/cell.ts#L3-L9) specifically to prevent this exception. However, `safeToString()` was not imported or reused in `profile/**`.
  *Remediation*: Export `safeToString` from `packages/engine/src/normalise/cell.ts` and use it uniformly in `stats.ts`, `inference.ts`, and `joins.ts`.

#### 3. Semantic Type Inference & Heuristics ([`packages/engine/src/profile/inference.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/inference.ts))
- **Finding REV-P2-04 (Medium - Heuristic Overfitting)**:
  To achieve 100% classification on all 28 synthetic fixtures, several heuristic keywords and overrides were hardcoded:
  - Line 65: `'caf_co_t_eur'` included in `CURRENCY_KEYWORDS` (tailored for Fixture 18: `18_financial_variance_waterfall.xlsx`).
  - Line 103: `'reading_value'` and `'national_id'` included in `TEXT_KEYWORDS` (tailored for Fixture 07 and 13).
  - Line 130-131: `'col_1'` in `ID_KEYWORDS` and `'col_4'` in `CATEGORY_KEYWORDS` (synthetic column names generated by un-named normalisations).
  - Line 145: `if (name.includes('expense_category')) return { inferredType: 'text' };` explicitly bypasses the `CATEGORY_KEYWORDS` match on `'category'` for Fixture 04 (`04_subtotal_grand_total.xlsx`).
  - Lines 419-421: Generic header overrides:
    ```typescript
    if (colKey === 'col_2' || colKey === 'col_3') {
      return { inferredType: 'text', confidence: 0.6 };
    }
    ```
  *Impact*: In production spreadsheets, if a user uploads a sheet where `col_1` is an integer quantity or `col_4` is a currency, it will be classified as an `id` or `category`. Similarly, any column containing `expense_category` will be forced to `text` instead of `category`.
  *Remediation*: Base inference on value distributions, cardinality ratios, and character patterns rather than specific synthetic column name strings (`col_1`, `col_4`) or specific fixture strings.

- **Finding REV-P2-06 (Low - Serial Date Keyword Coverage)**:
  In [`packages/engine/src/profile/inference.ts#L320-L328`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/inference.ts#L320-L328):
  Serial date detection checks if integer values fall in $[23000, 65000]$ (Excel serial dates between 1963 and 2078). However, it requires the column name to match `/serial|date|timestamp|launch|planned/i`.
  Columns representing dates named `created`, `updated`, `due`, `deadline`, `expires`, `shipped`, `start_date`, or `completion` will fail this regex and fall through to `number`.
  *Remediation*: Expand `SERIAL_DATE_KEYWORDS` to include standard date temporal words (`due`, `deadline`, `created`, `updated`, `expires`, `closed`, `shipped`, `start`, `end`).

---

### Category 3: Deterministic Spec Generation & Layout Geometry

#### 1. Rule-Based Synthesis & Grid Geometry ([`packages/engine/src/specgen/specgen.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/specgen/specgen.ts))
- **Grid Layout Rules**:
  - Unsheet specifies a 12-column grid system (`x` from 0 to 11, `w` from 1 to 12).
  - Metric Cards: `w: 3, h: 2` (4 cards per row of 12 columns).
  - Primary Visualizations (Charts/Bar/Line): `w: 6, h: 4` (2 charts per row of 12 columns).
  - Detailed Data Tables: `w: 12, h: 6` (Full row width).
- **Geometry Verification**:
  - The spec generator calculates layout coordinates dynamically using:
    ```typescript
    const x = (cardCount % 4) * 3;
    const y = Math.floor(cardCount / 4) * 2;
    ```
    and for charts:
    ```typescript
    const x = (chartCount % 2) * 6;
    const y = currentY + Math.floor(chartCount / 2) * 4;
    ```
  - For all generated widgets, $x + w \le 12$ holds strictly.
  - Property testing in [`packages/engine/test/specgen/specgen.test.ts#L228-L260`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/specgen/specgen.test.ts#L228-L260) asserts that for every pair of widgets $A \ne B$, their bounding boxes $[x, x+w) \times [y, y+h)$ do not intersect:
    ```typescript
    const overlap = !(
      a.pos.x + a.pos.w <= b.pos.x ||
      b.pos.x + b.pos.w <= a.pos.x ||
      a.pos.y + a.pos.h <= b.pos.y ||
      b.pos.y + b.pos.h <= a.pos.y
    );
    expect(overlap).toBe(false);
    ```
    This property passed 100% without a single failure across diverse sheet profiles.

#### 2. Widget Semantic Bindings & Contract Validation
- **Encoding Safety**:
  - Metric Cards select currency or number columns with valid aggregations (`sum`, `mean`, `count`).
  - Bar Charts bind `dimensionCol` to an inferred `category` column and `measureCol` to an inferred `currency` or `number` column.
  - Line Charts bind `dimensionCol` to an inferred `date` column and `measureCol` to a numerical column.
  - If a series column is assigned, it binds to a secondary category or boolean column.
  - Fallback Data Table binds `columnKeys` strictly to existing profile columns.
- **Contract Schema Validation**:
  - Generated dashboard specs are verified using `DashboardSpecSchema.parse(spec)` from `@unsheet/contracts`.
  - All specs pass strict Zod validation with 0 schema violations.

---

### Category 4: Schema Drift Detection & Coercion Rules

#### 1. Similarity Algorithms ([`packages/engine/src/drift/similarity.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/drift/similarity.ts))
- **Levenshtein Distance**:
  - Implements the Wagner-Fischer algorithm with space optimization.
  - Allocates two rows of length $\min(N, M) + 1$, achieving $O(\min(N, M))$ memory complexity instead of allocating an $O(N \times M)$ matrix.
  - Accurately computes normalized similarity: $1.0 - \frac{\text{dist}}{\max(N, M)}$.
- **Token Jaccard Similarity**:
  - Tokenizes column identifiers on underscores, dashes, spaces, and camelCase transitions (`[a-z][A-Z]`).
  - Compares token sets using Jaccard intersection over union: $\frac{|A \cap B|}{|A \cup B|}$.
  - Supports prefix matching for root stems (e.g. `cust` matching `customer`).
- **Composite Similarity**:
  - Weights Levenshtein (40%) and Jaccard (60%) when tokens exist.
  - Columns with similarity score $\ge 0.60$ are matched as renamed columns.

#### 2. Coercion Rules & Breaking Change Determination ([`packages/engine/src/drift/coercion.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/drift/coercion.ts), [`drift.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/drift/drift.ts))
- **Coercibility Matrix**:
  - `number` $\to$ `currency`, `percentage`, `text`: `true` (Safe formatting or string conversion).
  - `currency` / `percentage` $\to$ `number`: `true`.
  - `date` $\to$ `text`: `true`.
  - `boolean` $\to$ `text`: `true`.
  - `category` $\to$ `text`: `true`.
  - Incompatible transformations:
    - `text` $\to$ `number` / `currency` / `percentage` / `date` / `boolean`: `false` (Unsafe, potential parse errors).
    - `date` $\to$ `number` / `currency`: `false`.
    - `boolean` $\to$ `number`: `false`.
- **Breaking Change Classification**:
  - `breaking: true`:
    - Columns dropped from baseline to target.
    - Non-coercible type alterations (e.g., column altered from `text` to `currency`).
  - `breaking: false`:
    - Newly added columns.
    - Columns renamed with similarity $\ge 0.60$ and identical or coercible types.
    - Type changes that are marked coercible in the matrix.
- All edge conditions (empty sheets, identical sheets, completely disjoint schemas, swapped columns) are covered by dedicated test suites in [`packages/engine/test/drift/drift.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/drift/drift.test.ts).

---

### Category 5: Benchmarks, Accuracy & Code Coverage

#### 1. Code Coverage Analysis
Running Vitest with `@vitest/coverage-v8` on the engine package (`pnpm --filter @unsheet/engine test:coverage`):

| Scope | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| **Overall Engine Package** | **95.59%** | **88.74%** | **100%** | **95.59%** |
| `src/profile/` | 94.67% | 85.12% | 100% | 94.67% |
| `src/specgen/` | 94.04% | 82.85% | 100% | 94.04% |
| `src/drift/` | 95.89% | 82.64% | 100% | 95.89% |
| `src/normalise/` | 96.06% | 92.57% | 100% | 96.06% |
| `src/parse/` | 95.65% | 94.87% | 100% | 95.65% |

- **Threshold Compliance**:
  - Line Coverage: **95.59%** $\ge$ 90% required (**PASS**).
  - Branch Coverage: **88.74%** $\ge$ 85% required (**PASS**).
  - Function Coverage: **100.00%** $\ge$ 90% required (**PASS**).
- *Observation*: While overall engine branch coverage exceeds the 85% threshold, sub-modules `src/specgen/` (82.85%), `src/drift/` (82.64%), and `src/profile/stats.ts` (78.12%) have specific uncovered branches relating to fallback defaults and secondary guards.

#### 2. Semantic Profiling Accuracy Benchmark ([`packages/engine/test/benchmarks/accuracy.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/benchmarks/accuracy.test.ts))
- **Benchmark Design**:
  - Evaluates inferred semantic types against 28 fixture baselines (341 total columns) spanning financial statements, inventory, clinical trials, sensor logs, and CRM data.
- **Results**:
  - Matched Columns: **341 / 341**
  - Mismatches: **0**
  - Benchmark Accuracy: **100.00%** (Exceeds required $\ge 95\%$ target).
- *Caveat*: As highlighted in Finding REV-P2-04, part of this 100% accuracy was achieved by overfitting specific keyword tokens to match synthetic fixture naming conventions.

---

### Category 6: Performance, Algorithmic Complexity & Memory Allocations

#### 1. Single-Pass Row Aggregation
- Column statistics calculation in [`packages/engine/src/profile/stats.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/stats.ts#L18-L46) processes row values in a single loop ($O(N)$), accumulating `count`, `nullCount`, `sum`, `min`, `max`, and population values simultaneously.
- Frequency and distinct counting utilize standard `Map` and `Set` structures with $O(1)$ amortized lookups.

#### 2. Levenshtein Distance Memory Optimization
- In [`packages/engine/src/drift/similarity.ts#L22-L46`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/drift/similarity.ts#L22-L46):
  ```typescript
  let prevRow = new Array<number>(len2 + 1);
  let currRow = new Array<number>(len2 + 1);
  ```
  Rather than allocating an $(N+1) \times (M+1)$ matrix, it swaps two flat 1D arrays, reducing heap allocation from $O(N \times M)$ to $O(\min(N, M))$.

#### 3. Algorithmic Inefficiency: Join Candidate Search
- **Finding REV-P2-03 (Medium - Quadratic Repeated Extractions in Joins)**:
  In [`packages/engine/src/profile/joins.ts#L84-L112`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/joins.ts#L84-L112):
  ```typescript
  for (const colA of sheetA.columns) {
    const valuesA = sheetA.rows.map((r) => r[colA.name]);
    const setA = new Set<string>();
    ...
    for (const colB of sheetB.columns) {
      const valuesB = sheetB.rows.map((r) => r[colB.name]);
      const setB = new Set<string>();
      ...
      const typeB = inferColumnType(valuesB); // Re-inferred on every outer loop!
    }
  }
  ```
  In a workbook with $S$ sheets, $C$ columns per sheet, and $R$ rows per sheet:
  - For each sheet pair, `sheetB.rows.map(...)` is executed $C^2$ times instead of $C$ times.
  - `inferColumnType(valuesB)` is executed $C^2$ times instead of $C$ times.
  - For a 5-sheet workbook with 20 columns and 10,000 rows, this executes 8,000 redundant array allocations and 8,000 redundant type inferences.
  *Remediation*: Pre-compute and cache the string sets and column types for all columns in both sheets prior to entering the comparison loops ($O(C \times R)$ total instead of $O(C^2 \times R)$).

- **Finding REV-P2-07 (Low - Bidirectional Candidate Duplication)**:
  In [`packages/engine/src/profile/joins.ts#L77-L80`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/profile/joins.ts#L77-L80):
  The outer loop iterates over all pairs $(i, j)$ with $i \ne j$. If Sheet A's `customer_id` matches Sheet B's `customer_id` with 90% overlap, `findJoinCandidates()` records `(SheetA -> SheetB)`. When the loop reaches pair $(j, i)$, it records `(SheetB -> SheetA)`.
  This emits reciprocal duplicate candidates with identical overlap metrics.
  *Remediation*: Only evaluate ordered pairs where $i < j$ (or define canonical primary/foreign key direction based on uniqueness ratios).

---

## 4. Prioritized Remediation Roadmap

To ensure total renderer safety and production robustness before Phase 3 (Web UI, Canvas Renderer, and Interactive Dashboard integration), the following actions are recommended:

### Immediate Remediations (Pre-Phase 3 Integration)
1. **[REV-P2-01] Remove Unused Imports in Phase 2 Adversarial Suite**:
   Remove `DriftReportSchema`, `DashboardSpec`, `ColumnProfile`, `parseNumericValue`, `profileWorkbook`, `calculateColumnSimilarity`, `isCoercible` from [`packages/engine/test/adversarial/phase2_adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/phase2_adversarial.test.ts#L7-L27) to unblock `pnpm run lint` and `scripts/verify.sh`.
2. **[REV-P2-02] Fix Null-Prototype Crash in Profiler**:
   Import and use `safeToString()` from `packages/engine/src/normalise/cell.ts` across `profile/stats.ts`, `profile/inference.ts`, and `profile/joins.ts`. Add adversarial tests with `Object.create(null)` in row records.
3. **[REV-P2-03] Pre-compute Column Value Sets in Join Candidate Detection**:
   Refactor `findJoinCandidates` in `packages/engine/src/profile/joins.ts` to pre-build `Map<string, Set<string>>` and pre-resolve column types once per sheet before the nested comparison loop.
4. **[REV-P2-05] Promote `WorkbookProfile` and `JoinCandidate` to `@unsheet/contracts`**:
   Define `WorkbookProfileSchema` and `JoinCandidateSchema` in `packages/contracts/src/profile.ts`, and export their inferred types. Update `packages/engine/src/profile/workbook.ts` and `joins.ts` to import them from `@unsheet/contracts`.

### Hardening & Maintenance Remediations (Phase 3 Polish)
5. **[REV-P2-04] Generalize Type Inference Heuristics**:
   Remove brittle overrides for synthetic header names (`col_1`, `col_4`, `expense_category`, `caf_co_t_eur`) and rely on distribution entropy and format regexes.
6. **[REV-P2-06] Expand Serial Date Keywords**:
   Add common date-adjacent terms (`due`, `deadline`, `created`, `updated`, `expires`, `completed`, `shipped`) to `SERIAL_DATE_KEYWORDS`.
7. **[REV-P2-07] Deduplicate Reciprocal Join Candidates**:
   Enforce canonical primary $\to$ foreign key ordering in `joins.ts` based on uniqueness ratios (the sheet with higher uniqueness ratio as primary key).
8. **[REV-P2-08] Validate Identifier Assertion**:
   Replace `'id' as SafeIdentifier` in `specgen.ts#L169` with `SafeIdentifierSchema.parse('id')`.
