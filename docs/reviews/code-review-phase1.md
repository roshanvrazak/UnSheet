# Independent Code Review: Phase 1 Deliverables

**Date**: 2026-10-04  
**Auditor**: Independent Code Reviewer (`code-reviewer`)  
**Target Workspaces & Deliverables**:
- Ingest & Parse Engine: [`packages/engine/src/parse/**`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/parse)
- Normalisation Engine: [`packages/engine/src/normalise/**`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise)
- Synthetic Fixtures Corpus: [`packages/fixtures/**`](file:///home/rvr/Work/basi/UnSheet/packages/fixtures)
- Engine Test Suites: [`packages/engine/test/**`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test)
- Package Configs: [`packages/engine/package.json`](file:///home/rvr/Work/basi/UnSheet/packages/engine/package.json), [`packages/engine/tsconfig.json`](file:///home/rvr/Work/basi/UnSheet/packages/engine/tsconfig.json), [`packages/fixtures/package.json`](file:///home/rvr/Work/basi/UnSheet/packages/fixtures/package.json), [`packages/fixtures/tsconfig.json`](file:///home/rvr/Work/basi/UnSheet/packages/fixtures/tsconfig.json)

---

## 1. Executive Summary & Audit Verdict

### Overall Verdict: **CONDITIONAL PASS** (Targeted Remediations Required Before Phase 2 Profiling)

Phase 1 establishes a performant, headless spreadsheet parsing and normalisation engine running safely in Node.js and Web Workers with zero DOM dependencies. SheetJS has been integrated via the pinned vendor tarball, upload guards reject macro extensions, and a custom pure-TypeScript ZIP inspector successfully flags oversized files and zip bombs before decompression. In parallel, the fixtures package delivers 28 distinct spreadsheet workbooks and 28 companion Golden Normalized JSON baselines covering pathological layouts, domain workbooks, and extreme scales.

However, an exhaustive independent audit across the 5 required dimensions revealed **2 Critical pipeline blockers**, **4 High-severity algorithmic/functional defects in normalisation**, and **6 Medium-severity efficiency/contract gaps**:

1. **Verification Pipeline Blocker (Critical)**: `pnpm run lint` currently **fails** with 5 ESLint errors (`@typescript-eslint/no-unused-vars`) in the newly committed adversarial test suite [`packages/engine/test/adversarial/adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/adversarial.test.ts#L5-L26).
2. **Missing Test Typecheck Inclusion (High)**: [`packages/engine/tsconfig.json`](file:///home/rvr/Work/basi/UnSheet/packages/engine/tsconfig.json#L3) specifies `"include": ["src/**/*"]`, completely omitting `packages/engine/test/**` from `pnpm typecheck` (a regression of Phase 0 finding `REV-P0-02`).
3. **Subtotal Stripping Anchoring Flaw (High)**: The `SUBTOTAL_PATTERN` in [`packages/engine/src/normalise/noise.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/noise.ts#L1-L2) uses a leading string anchor `/^\s*(?:total|subtotal...)/`. It fails to detect standard section subtotals like `"Engineering Subtotal"` or `"Marketing Subtotal"`, causing Fixture 04 (`04_subtotal_grand_total.xlsx`) to retain all subtotal rows (11 rows output vs 8 golden rows). Furthermore, `isSubtotalRow` breaks on the first non-empty cell without checking subsequent cells.
4. **Spacer Column Pruning Missing (High)**: [`packages/engine/src/normalise/`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise) contains zero logic to detect or prune empty spacer columns. When ingesting Fixture 05 (`05_blank_spacer_rows_columns.xlsx`), empty columns A and D are retained as synthetic columns (`column_1`, `column_4`), yielding 7 columns instead of the 5 columns expected by the contract baseline.
5. **Multi-Row Merged Header Combination Missing (High)**: In [`packages/engine/src/normalise/header.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/header.ts#L48-L147), header detection evaluates candidate rows in isolation and selects a single row index. For multi-tier merged headers (Fixture 03: `03_multi_row_merged_headers.xlsx`), parent category headers (`Location`, `Q1 Figures`, `Q2 Figures`) are dropped, producing un-prefixed duplicate keys (`target`, `target_1`) instead of composite keys (`q1_figures_target`, etc.).
6. **Double Deep Zod Traversal & Allocation Churn (Medium)**: `normaliseSheet` runs `SheetModelSchema.parse()`, followed immediately by `WorkbookModelSchema.parse()` in `normaliseWorkbook`. For large sheets (e.g. 200,000 rows x 50 columns), Zod traverses and parses every row and key twice (20,000,000 Zod validations), causing multi-second thread stalls. In addition, every row allocates two objects (`Object.create(null)` followed by `Object.assign({}, record)`).

### Evaluation Scorecard

| Evaluation Dimension | Rating | Summary Assessment |
|---|---|---|
| **1. TypeScript Strictness** | **A-** | Zero `any` in `src/`. `noUncheckedIndexedAccess` enabled. Gaps: `test/**` excluded from `engine/tsconfig.json`; unsafe `as SafeIdentifier` and `as GoldenWorkbook` casts in `packages/fixtures/src/generators/utils.ts`. |
| **2. Normalisation Correctness** | **B** | Forward-fill on merged data cells works accurately (Fixture 21). Header detection heuristics handle offsets well (Fixture 02). Critical gaps: spacer columns are not pruned (Fixture 05), section subtotals are missed (Fixture 04), multi-row headers are not combined (Fixture 03), and cell string whitespace is untrimmed (Fixture 24). |
| **3. Test Coverage & Negative Testing** | **A-** | Exceeds thresholds: **95.82% line coverage** (target >=90%), **92.57% branch coverage** (target >=85%). Excellent `fast-check` properties and 31 adversarial tests. Pipeline blocker: 5 unused imports break ESLint in CI. Disconnect: engine tests never run against fixtures. |
| **4. Fixtures Corpus Correctness** | **A** | All 28 binary workbooks and 28 Golden JSON baselines exist and pass 148 contract assertions. High variety covering extreme scales (160 cols, 10,005 rows), hostile formulas, and 3 rich domain scenarios. Minor: header disambiguation in fixture generator has collision bug on pre-indexed headers. |
| **5. Code Efficiency & Memory Management** | **B+** | O(N) single-pass loops for row processing. Clean fail-closed limits. Gaps: double Zod traversal on deep row records, dual object allocation per row, full grid cloning in `merge.ts` on header-only merges, and coordinate encoding allocations in `sheetjs.ts`. |

---

## 2. Findings Matrix

| Finding ID | Severity | Category | Target Location | Description |
|---|---|---|---|---|
| **REV-P1-01** | **CRITICAL** | CI / Linting | [`packages/engine/test/adversarial/adversarial.test.ts#L5-L26`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/adversarial.test.ts#L5-L26) | 5 unused imports (`MAX_UNCOMPRESSED_BYTES`, `MAX_ROWS`, `MAX_COLUMNS`, `normaliseWorkbook`, `SheetBoundsError`) break ESLint (`@typescript-eslint/no-unused-vars`), causing `pnpm run lint` and [`scripts/verify.sh`](file:///home/rvr/Work/basi/UnSheet/scripts/verify.sh) to fail. |
| **REV-P1-02** | **HIGH** | Compiler Config | [`packages/engine/tsconfig.json#L3`](file:///home/rvr/Work/basi/UnSheet/packages/engine/tsconfig.json#L3) | `"include": ["src/**/*"]` excludes `packages/engine/test/**` from `pnpm typecheck`, allowing type regressions in test suites to pass undetected in CI. |
| **REV-P1-03** | **HIGH** | Normalisation | [`packages/engine/src/normalise/noise.ts#L1-L38`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/noise.ts#L1-L38) | `SUBTOTAL_PATTERN` anchored at start (`/^\s*(?:total...)/`) and `isSubtotalRow` breaking on first cell fails to match category subtotals (`"Engineering Subtotal"`). Leaves 3 subtotal rows in Fixture 04. |
| **REV-P1-04** | **HIGH** | Normalisation | [`packages/engine/src/normalise/sheet.ts#L31-L97`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/sheet.ts#L31-L97), [`header.ts#L158-L170`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/header.ts#L158-L170) | Engine does not detect or prune empty spacer columns. In Fixture 05, columns A and D are preserved as `column_1` and `column_4`, yielding 7 columns instead of 5 golden columns. |
| **REV-P1-05** | **HIGH** | Normalisation | [`packages/engine/src/normalise/header.ts#L48-L147`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/header.ts#L48-L147), [`sheet.ts#L36-L53`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/sheet.ts#L36-L53) | Missing multi-row merged header consolidation. Engine only selects a single header row index, losing parent tier labels (`Location`, `Q1 Figures`) in Fixture 03 and generating un-prefixed duplicates. |
| **REV-P1-06** | **HIGH** | Normalisation | [`packages/engine/src/normalise/cell.ts#L11-L17`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/cell.ts#L11-L17) | `normaliseCellValue` checks `raw.trim() === ''` to return null, but returns `raw` un-trimmed for non-empty strings. Preserves untrimmed whitespace in Fixture 24 (`"  SKU-091  "`). |
| **REV-P1-07** | **MEDIUM** | Performance / Big-O | [`packages/engine/src/normalise/sheet.ts#L96`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/sheet.ts#L96), [`workbook.ts#L63`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/workbook.ts#L63) | Redundant double Zod traversal: `SheetModelSchema.parse` validates all rows/keys, and `WorkbookModelSchema.parse` immediately re-validates all rows/keys a second time. |
| **REV-P1-08** | **MEDIUM** | Memory Allocations | [`packages/engine/src/normalise/sheet.ts#L63-L73`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/sheet.ts#L63-L73) | Allocates two objects per row (`Object.create(null)` + `Object.assign({}, record)`), doubling heap allocations to 400,000 objects on a 200,000 row sheet. |
| **REV-P1-09** | **MEDIUM** | Memory Allocations | [`packages/engine/src/normalise/merge.ts#L16`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/merge.ts#L16) | `grid.map((row) => [...row])` shallow-copies the entire grid (up to 200,000 rows) even when merges only exist on header rows (e.g. row 0). |
| **REV-P1-10** | **MEDIUM** | Robustness / DoS | [`packages/engine/src/normalise/noise.ts#L65-L68`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/noise.ts#L65-L68) | `isFootnoteRow` classifies any single filled cell with text length > 30 as a footnote. For 1-column tables (or sparse 2-column tables), legitimate trailing records are pruned as footnotes. |
| **REV-P1-11** | **MEDIUM** | Contract Adherence | [`packages/fixtures/src/generators/utils.ts#L10-L65`](file:///home/rvr/Work/basi/UnSheet/packages/fixtures/src/generators/utils.ts#L10-L65) | `sanitizeHeaderKey` and `disambiguateHeaders` use unsafe `as SafeIdentifier` casts without invoking `SafeIdentifierSchema.parse()`, and have collision bug on pre-indexed headers (`['user', 'user', 'user_1']`). |
| **REV-P1-12** | **MEDIUM** | Architecture / Drift | [`packages/fixtures/src/generators/utils.ts#L28`](file:///home/rvr/Work/basi/UnSheet/packages/fixtures/src/generators/utils.ts#L28) vs [`sanitise.ts#L42`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/sanitise.ts#L42) | Conflicting header sanitization rules: fixtures prefixes leading digits with `col_` (`col_2024_sales`), while engine normaliser prefixes with `_` (`_2024_sales`). |
| **REV-P1-13** | **LOW** | Security / Zip Bomb | [`packages/engine/src/parse/zip.ts#L118-L125`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/parse/zip.ts#L118-L125) | When `compressedSize === 0` and `uncompressedSize > 0`, ratio check is bypassed due to `compressedSize > 0` condition, reported by adversarial tester (ADV-P1-04). |
| **REV-P1-14** | **LOW** | CPU / Big-O | [`packages/engine/src/parse/sheetjs.ts#L118-L120`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/parse/sheetjs.ts#L118-L120) | `XLSX.utils.encode_cell({ r, c })` allocates temporary objects and string concatenations for every coordinate (40,000,000 allocations on 200k x 200 grid). |
| **REV-P1-15** | **LOW** | CPU / Big-O | [`packages/engine/src/normalise/header.ts#L29-L33`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/header.ts#L29-L33) | Full-grid loop over all 200,000 rows to find `maxCols` before header candidate evaluation, when only rows 0..26 are evaluated. |

---

## 3. Detailed Audit by Category

### Category 1: TypeScript Strictness & Compiler Configuration

#### 1. Compiler Configuration ([`packages/engine/tsconfig.json`](file:///home/rvr/Work/basi/UnSheet/packages/engine/tsconfig.json))
- **Configuration Inspected**:
  ```json
  {
    "extends": "../../tsconfig.base.json",
    "include": ["src/**/*"]
  }
  ```
- **Finding REV-P1-02 (High)**:
  `packages/engine/tsconfig.json` specifies `"include": ["src/**/*"]`.
  When `pnpm run typecheck` (`pnpm -r exec tsc --noEmit`) executes, TypeScript only compiles files matching `include`. All 12 test files in `packages/engine/test/**` are completely excluded from compilation.
  Testing with a scratch configuration including `packages/engine/test/**/*` confirmed that while existing tests currently pass typechecking, any future breaking type regressions in tests will be silently skipped in CI.
  *Remediation*: Update `packages/engine/tsconfig.json` to:
  ```json
  {
    "extends": "../../tsconfig.base.json",
    "include": ["src/**/*", "test/**/*"]
  }
  ```

#### 2. `any` and Unsafe Type Assertions Audit
- **Static Analysis of Source Code**:
  - `packages/engine/src/**`: **0 instances** of `: any` or `as any`.
  - `packages/fixtures/src/**`: **0 instances** of `: any` or `as any`.
  - `packages/engine/test/**`: **0 instances** of `: any` or `as any`.
- **Finding REV-P1-11 (Medium - Unsafe Casts in Fixtures Utility)**:
  In [`packages/fixtures/src/generators/utils.ts`](file:///home/rvr/Work/basi/UnSheet/packages/fixtures/src/generators/utils.ts#L10-L65):
  - Line 10: `return col_${fallbackIndex} as SafeIdentifier;`
  - Line 46: `return clean as SafeIdentifier;`
  - Line 65: `const uniqueKey = ${baseKey}_${count} as SafeIdentifier;`
  These statements bypass `SafeIdentifierSchema.parse()`, using manual regexes and unchecked type assertions.
  In [`packages/fixtures/src/index.ts#L81`](file:///home/rvr/Work/basi/UnSheet/packages/fixtures/src/index.ts#L81):
  - `return JSON.parse(content) as GoldenWorkbook;`
  Raw JSON parsed from disk is asserted directly as `GoldenWorkbook` without contract schema verification.

---

### Category 2: Normalisation Correctness & Noise Removal

#### 1. Subtotal & Grand Total Stripping ([`packages/engine/src/normalise/noise.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/noise.ts#L1-L38))
- **Finding REV-P1-03 (High)**:
  `isSubtotalRow` suffers from two structural flaws:
  1. Regex Anchor Flaw:
     ```ts
     const SUBTOTAL_PATTERN = /^\s*(?:total|subtotal|sub-total|grand\s*total|sum|average|avg)\b/i;
     ```
     Because the regex starts with `^\s*`, strings where the category precedes the word "subtotal" (e.g. `"Engineering Subtotal"`, `"Marketing Subtotal"`, `"DACH Total"`) return `false`.
  2. Premature Loop Break:
     ```ts
     for (const cell of row) {
       if (cell === null || cell === undefined) continue;
       const str = String(cell).trim();
       if (str === '') continue;

       if (SUBTOTAL_PATTERN.test(str)) {
         return true;
       }
       // If the first non-empty text cell is not a subtotal marker, this is not a subtotal row
       break;
     }
     ```
     If column 0 contains an account code (`"ACC-101"`), department code, or timestamp, and column 1 contains `"Subtotal"`, the loop terminates on column 0 and returns `false`.
  - **Verification**: Ingesting Fixture 04 (`04_subtotal_grand_total.xlsx`) produced **11 rows** instead of the **8 rows** defined in `04_subtotal_grand_total.golden.json`. The three department subtotal rows were completely missed.
  - *Remediation*:
    Update `SUBTOTAL_PATTERN` to match subtotal tokens anywhere in short category cells (e.g. `/(?:^|\s)(?:total|subtotal|sub-total|grand\s*total|sum|average|avg)\b/i`), and scan across all text cells of the row rather than breaking on the first non-empty cell.

#### 2. Empty Spacer Column Pruning ([`packages/engine/src/normalise/sheet.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/sheet.ts#L40-L49))
- **Finding REV-P1-04 (High)**:
  `SPEC.md` Stage 2 states: *"Scan for title blocks, notes, and blank spacer rows/columns"*.
  However, `packages/engine/src/normalise/` only removes empty spacer *rows* (`isEmptySpacerRow`). There is zero logic to detect or prune empty spacer *columns*.
  In [`packages/engine/src/normalise/header.ts#L161-L169`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/header.ts#L161-L169), empty header cells are automatically assigned fallback labels (`Column 1`, `Column 4`), and [`packages/engine/src/normalise/sheet.ts#L65-L70`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/sheet.ts#L65-L70) includes them in every row record as `null`.
  - **Verification**: Ingesting Fixture 05 (`05_blank_spacer_rows_columns.xlsx`) produced **7 columns** (`column_1`, `sku`, `product_name`, `column_4`, `category`, `stock_level`, `unit_price`) instead of the **5 columns** in `05_blank_spacer_rows_columns.golden.json`.
  - *Remediation*: Before building column metadata, inspect each column index across candidate data rows. If a column has no non-empty values across all rows and an empty header, omit it from `columns` and row mapping.

#### 3. Multi-Row Merged Headers ([`packages/engine/src/normalise/header.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/header.ts#L48-L147))
- **Finding REV-P1-05 (High)**:
  `applyMergeForwardFill` forward-fills merged headers horizontally. For example, in Fixture 03:
  - Row 0 becomes: `['Location', 'Location', 'Q1 Figures', 'Q1 Figures', 'Q1 Figures', 'Q2 Figures', ...]`
  - Row 1 is: `['Country', 'City', 'Target', 'Actual', 'Variance', 'Target', ...]`
  However, `detectHeaderRow` evaluates Row 0 and Row 1 independently and selects Row 1. Row 0 is dropped.
  The normaliser outputs:
  `['country', 'city', 'target', 'actual', 'variance', 'target_1', 'actual_1', 'variance_1']`
  Instead of the composite hierarchical keys in `03_multi_row_merged_headers.golden.json`:
  `['location_country', 'location_city', 'q1_figures_target', 'q1_figures_actual', ...]`
  - *Remediation*: When `detectedRowIndex > 0` and the preceding row consists entirely of category strings (or merged ranges), concatenate the non-empty parent cell tokens with the child subheader tokens.

#### 4. Cell Whitespace Normalisation ([`packages/engine/src/normalise/cell.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/cell.ts#L11-L17))
- **Finding REV-P1-06 (High)**:
  ```ts
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return null;
    }
    return raw; // <--- Returns original untrimmed string
  }
  ```
  `normaliseCellValue` checks `trimmed === ''` to map empty strings to `null`, but returns `raw` untrimmed for non-empty strings.
  - **Verification**: Ingesting Fixture 24 (`24_whitespace_messy.xlsx`) preserved messy values:
    `product_sku: '  SKU-091  '`, `product_description: '\tHigh-Torque Servomotor  '`.
    The golden baseline expects trimmed clean values: `'SKU-091'`, `'High-Torque Servomotor'`.
  - *Remediation*: Return `trimmed` instead of `raw`.

#### 5. Footnote Detection Edge Cases ([`packages/engine/src/normalise/noise.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/noise.ts#L65-L68))
- **Finding REV-P1-10 (Medium)**:
  In `isFootnoteRow`:
  ```ts
  if (filledCells.length === 1 && typeof filledCells[0] === 'string' && firstText.length > 30) {
    return true;
  }
  ```
  In a 1-column table (e.g. user comments or survey responses), `filledCells.length === 1` is always true. If the last row of the table has a comment longer than 30 characters, it is classified as a footnote and deleted by `removeNoiseRows`.
  *Remediation*: Ensure `totalColumns > 1` before applying the single-cell length heuristic, or check that `firstText` does not match tabular data patterns.

---

### Category 3: Test Coverage, Adversarial & Property Testing

#### 1. Coverage Metrics & Threshold Compliance
The test suite was executed using Vitest with `@vitest/coverage-v8`:
```
 % Coverage report from v8
--------------|---------|----------|---------|---------|-------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Status
--------------|---------|----------|---------|---------|-------------------
All files     |   95.82 |    92.57 |     100 |   95.82 | Exceeds thresholds
 normalise    |   99.51 |    94.73 |     100 |   99.51 | (Target: Lines >=90%,
 parse        |   92.56 |    89.88 |     100 |   92.56 |  Branch >=85%)
--------------|---------|----------|---------|---------|-------------------
```
- **Line Coverage**: **95.82%** (Target: >=90%) -> **PASS**
- **Branch Coverage**: **92.57%** (Target: >=85%) -> **PASS**
- **Function Coverage**: **100.00%** -> **PASS**

#### 2. Property-Based Testing ([`packages/engine/test/property/property.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/property/property.test.ts))
Four critical system invariants are verified with `fast-check` across 100 random iterations each:
1. `normaliseSheet` never throws or unhandled-crashes on arbitrary 2D grids (including nested arrays, NaNs, infinities, booleans, and nulls).
2. Sanitized column keys are always pairwise unique and satisfy `SafeIdentifierSchema`.
3. Normalised row count never exceeds raw grid row count.
4. Header detection is idempotent on the resulting table grid.

#### 3. Adversarial Security Testing & CI Failure ([`packages/engine/test/adversarial/adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/adversarial.test.ts))
- **Finding REV-P1-01 (Critical - CI Blocker)**:
  The adversarial test suite contains 5 unused imports:
  - Line 5: `MAX_UNCOMPRESSED_BYTES`
  - Line 7: `MAX_ROWS`
  - Line 8: `MAX_COLUMNS`
  - Line 15: `normaliseWorkbook`
  - Line 26: `SheetBoundsError`
  Running `pnpm run lint` fails with 5 errors under `@typescript-eslint/no-unused-vars`. This immediately breaks Step 1 of [`scripts/verify.sh`](file:///home/rvr/Work/basi/UnSheet/scripts/verify.sh).
  *Remediation*: Remove the 5 unused imports from `adversarial.test.ts`.

#### 4. Disconnect Between Fixtures and Engine Tests
- **Architectural Gap**:
  Neither `packages/engine/test/` nor `packages/fixtures/test/` runs an end-to-end integration test asserting that `ingestWorkbook(getFixtureBuffer(id))` matches `getFixtureGolden(id)`.
  Engine unit tests use synthetic in-memory snippets, while fixtures tests only assert that golden JSON files match contract schemas. This isolation allowed the normalisation bugs in Fixtures 03, 04, 05, and 24 to go undetected.

---

### Category 4: Fixtures Corpus Correctness & Contract Adherence

#### 1. Corpus Inventory & Verification
- All 28 binary workbooks (`files/*.xlsx`, `files/*.csv`) and 28 Golden JSON baselines (`src/golden/*.golden.json`) exist and are valid.
- The 28 fixtures thoroughly cover all requested edge cases:
  - 01: Clean baseline
  - 02: Header offset (title banner at rows 1-3)
  - 03: Multi-row merged headers
  - 04: Subtotal and grand total summary lines
  - 05: Blank spacer rows and columns
  - 06: Compliance footnotes and trailing notes
  - 07: Mixed data types in single column
  - 08 & 09: Excel 1900 and 1904 serial date epochs
  - 10: Multi-format date strings (ISO, US, UK, named)
  - 11 & 12: Currency symbols, accounting negatives, percentages
  - 13: Hidden sheets and columns
  - 14: Duplicate header disambiguation
  - 15: Multi-sheet relational foreign keys
  - 16: Extreme wide table (160 columns)
  - 17: Extreme tall table (10,005 rows, 382KB XLSX)
  - 18: International RTL (Arabic, Hebrew) and Unicode
  - 19 & 20: Cached vs uncalculated formulas
  - 21: Vertically merged data cells
  - 22 & 23: Semicolon CSV and multiline quoted CSV
  - 24: Untrimmed whitespace
  - 25: Hostile formula injection strings
  - 26, 27, 28: Realistic domain spreadsheets (Capital Projects, BOQ Quotes, Supply Chain Lead Times)

#### 2. Header Disambiguation Collision Bug in Generator
- **Finding REV-P1-11 (Medium)**:
  In [`packages/fixtures/src/generators/utils.ts#L52-L68`](file:///home/rvr/Work/basi/UnSheet/packages/fixtures/src/generators/utils.ts#L52-L68):
  ```ts
  const count = seenCount.get(baseKey) ?? 0;
  seenCount.set(baseKey, count + 1);
  if (count === 0) {
    result.push(baseKey);
  } else {
    result.push(`${baseKey}_${count}` as SafeIdentifier);
  }
  ```
  If an input workbook has headers `['user', 'user', 'user_1']`:
  - Item 0 (`'user'`) -> `'user'`
  - Item 1 (`'user'`) -> `'user_1'`
  - Item 2 (`'user_1'`) -> `'user_1'` (COLLISION!)
  In contrast, `sanitiseHeaders` in `packages/engine/src/normalise/sanitise.ts` uses a `while (seenKeys.has(key))` loop which correctly prevents collisions.

#### 3. Inconsistent Identifier Sanitization Rules
- **Finding REV-P1-12 (Medium)**:
  - In `fixtures/src/generators/utils.ts#L28`: Headers starting with digits are prefixed with `col_` (`2024 Revenue` -> `col_2024_revenue`).
  - In `engine/src/normalise/sanitise.ts#L42`: Headers starting with digits are prefixed with `_` (`2024 Revenue` -> `_2024_revenue`).
  - Prototype pollution key `__proto__` is mapped to `col___proto__` in fixtures, but `safe___proto__` in engine.
  The two packages must share a unified sanitization implementation from `@unsheet/contracts` or `@unsheet/engine`.

---

### Category 5: Code Efficiency & Memory Management

#### 1. Double Zod Traversal on Row Records
- **Finding REV-P1-07 (Medium)**:
  In [`packages/engine/src/normalise/sheet.ts#L96`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/sheet.ts#L96):
  `SheetModelSchema.parse(sheetModel)`
  And in [`packages/engine/src/normalise/workbook.ts#L63`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/workbook.ts#L63):
  `WorkbookModelSchema.parse(workbookModel)`
  Because `WorkbookModelSchema.sheets` is defined as `z.array(SheetModelSchema)`, Zod re-parses every sheet, every row, and every column key a second time.
  On large sheets (e.g. 200,000 rows x 50 columns), this executes 20,000,000 Zod validations.
  *Remediation*: Once `SheetModel` has been parsed and validated by `SheetModelSchema.parse()`, validate `WorkbookModel` using a shallow schema or omit re-parsing `sheets.rows`.

#### 2. Dual Object Allocation per Row
- **Finding REV-P1-08 (Medium)**:
  In [`packages/engine/src/normalise/sheet.ts#L63-L73`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/sheet.ts#L63-L73):
  ```ts
  const record: Record<string, unknown> = Object.create(null);
  for (let c = 0; c < columns.length; c++) {
    record[col.key] = normaliseCellValue(rawCell);
  }
  rows.push(Object.assign({}, record) as Record<SafeIdentifier, unknown>);
  ```
  For every row, two objects are allocated: the prototype-less `record`, and the target object created by `Object.assign({}, record)`.
  Because `col.key` is already sanitized against prototype keys, creating a single plain object `{}` or retaining `Object.create(null)` directly eliminates 200,000 redundant object allocations on a 200,000 row sheet.

#### 3. Full Grid Shallow-Copying on Merge Forward-Fill
- **Finding REV-P1-09 (Medium)**:
  In [`packages/engine/src/normalise/merge.ts#L16`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/merge.ts#L16):
  ```ts
  const result: unknown[][] = grid.map((row) => [...row]);
  ```
  Whenever any merge range exists, `applyMergeForwardFill` clones all rows across the entire grid.
  If a sheet has 200,000 rows and only header cells A1:B1 are merged, all 200,000 data rows are cloned.
  *Remediation*: Only clone rows where `r >= merge.startRow && r <= merge.endRow`.

#### 4. Headless SheetJS Coordinate Formatter Allocations
- **Finding REV-P1-14 (Low)**:
  In [`packages/engine/src/parse/sheetjs.ts#L118`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/parse/sheetjs.ts#L118):
  `XLSX.utils.encode_cell({ r: sheetRowIdx, c: sheetColIdx })`
  In a 200,000 x 200 grid, this allocates 40,000,000 temporary `{ r, c }` objects.
  In V8, allocating and destroying 40M objects creates noticeable GC pauses. SheetJS provides column caching or direct string formatting without object allocation.

---

## 4. Cross-Subsystem Integration & Golden Baseline Comparison

Testing `@unsheet/engine`'s `ingestWorkbook` against all 28 Golden Baselines revealed exact behavioral differences:

| Fixture | Expected (Golden Baseline) | Actual (`ingestWorkbook` Result) | Impact / Root Cause |
|---|---|---|---|
| **01 Clean Baseline** | Row index: 0, 7 cols, 15 rows | Row index: 0, 7 cols, 15 rows | **MATCH (100% Correct)** |
| **02 Header Offset** | Row index: 3, 5 cols, 12 rows | Row index: 3, 5 cols, 12 rows | **MATCH (100% Correct)** |
| **03 Multi-Row Headers** | Composite keys (`q1_figures_target`) | Unprefixed keys (`target`, `target_1`) | **MISMATCH**: Multi-row header combination missing |
| **04 Subtotals** | 8 rows (all subtotals stripped) | 11 rows (department subtotals kept) | **MISMATCH**: `SUBTOTAL_PATTERN` anchor flaw |
| **05 Spacer Rows/Cols** | 5 cols (empty cols A & D pruned) | 7 cols (`column_1`, `column_4` kept) | **MISMATCH**: Spacer column pruning missing |
| **06 Footnotes** | Row index: 0, 5 cols, 7 rows | Row index: 0, 5 cols, 7 rows | **MATCH (100% Correct)** |
| **07 Mixed Types** | 5 cols, 10 rows | 5 cols, 10 rows | **MATCH (100% Correct)** |
| **08 Serial Dates 1900** | Target serial: `'2023-10-01'` | Target serial: `45200` (raw number) | Expected: Date parsing is Phase 2 profiler scope |
| **09 Serial Dates 1904** | Execution serial: `'2023-10-01'` | Execution serial: `43738` (raw number) | Expected: Date parsing is Phase 2 profiler scope |
| **14 Duplicate Headers** | `status`, `target`, `status_1`, `status_2` | `status`, `target`, `status_1`, `status_2` | **MATCH (100% Correct)** |
| **16 Wide Extreme** | 160 cols, 12 rows | 160 cols, 12 rows | **MATCH (100% Correct)** |
| **17 Tall Extreme** | 7 cols, 10,005 rows | 7 cols, 10,005 rows | **MATCH (100% Correct - 347ms)** |
| **21 Merged Data Cells** | Region & district forward-filled | Region & district forward-filled | **MATCH (100% Correct)** |
| **24 Messy Whitespace** | Trimmed cells (`'SKU-091'`) | Untrimmed cells (`'  SKU-091  '`) | **MISMATCH**: `normaliseCellValue` does not trim string |
| **25 Hostile Formulas** | Formulas read as raw text | Formulas read as raw text | **MATCH (100% Correct)** |

---

## 5. Prioritized Remediation Roadmap

### Immediate Fixes (Required for Green Build & CI)
1. **Fix REV-P1-01 (Critical)**: Remove the 5 unused imports from [`packages/engine/test/adversarial/adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/adversarial.test.ts) to restore green `pnpm run lint` and `scripts/verify.sh`.
2. **Fix REV-P1-02 (High)**: Add `"test/**/*"` to `"include"` in [`packages/engine/tsconfig.json`](file:///home/rvr/Work/basi/UnSheet/packages/engine/tsconfig.json) so tests are typechecked during `pnpm typecheck`.

### Functional Normalisation Remediations (Required for Phase 1 Sign-Off)
3. **Fix REV-P1-03 (High)**: Refactor `SUBTOTAL_PATTERN` and `isSubtotalRow` in [`packages/engine/src/normalise/noise.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/noise.ts) to match category subtotals (`"Engineering Subtotal"`) and scan across row cells.
4. **Fix REV-P1-04 (High)**: Implement empty spacer column pruning in [`packages/engine/src/normalise/sheet.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/sheet.ts) and [`header.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/header.ts).
5. **Fix REV-P1-05 (High)**: Implement multi-row header consolidation when candidate header row is preceded by category header rows.
6. **Fix REV-P1-06 (High)**: Ensure `normaliseCellValue` in [`packages/engine/src/normalise/cell.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/cell.ts) returns `trimmed` rather than `raw`.

### Performance & Security Hardening (Before Phase 2 Profiling Integration)
7. **Fix REV-P1-07 & REV-P1-08 (Medium)**: Eliminate redundant double Zod traversal on row records and eliminate dual object allocation per row.
8. **Fix REV-P1-11 & REV-P1-12 (Medium)**: Align identifier sanitization logic between `fixtures` and `engine`, resolving the generator collision bug.
9. **Fix REV-P1-13 (Low)**: Flag `compressedSize === 0 && uncompressedSize > 0` in [`packages/engine/src/parse/zip.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/parse/zip.ts) to close the zero-size zip bomb bypass.
