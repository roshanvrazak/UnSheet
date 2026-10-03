# Phase 1 Architecture & Contracts Fixes Handoff

## 1. Executive Summary

Phase 1 contract hardening has been implemented on branch `agent/architect/phase1-contract-fixes` addressing the findings from the Phase 1 independent reviews (`security-phase1.md`, `code-review-phase1.md`, `adversarial-phase1.md`).

All contract schemas and refinements have been implemented in `packages/contracts`, backed by unit and adversarial tests. Both `pnpm --filter @unsheet/contracts test` and `pnpm --filter @unsheet/contracts build` pass cleanly with zero ESLint warnings/errors and 100% test passing rate (70/70 tests).

---

## 2. Implemented Contract Refinements

### 1. Sheet Name Prototype Pollution Guard (`ADV-P1-05`, `ADV-P1-06`, `SEC-P1-04`)
- **Target**: `packages/contracts/src/workbook.ts` (`SheetModelSchema.shape.name`)
- **Implementation**:
  Imported `FORBIDDEN_OBJECT_KEYS` from `./common.js` and added a case-insensitive, whitespace-trimmed refinement to `SheetModelSchema.shape.name`:
  ```ts
  name: z
    .string()
    .min(1, 'Sheet name must not be empty')
    .max(128, 'Sheet name exceeds maximum length of 128 characters')
    .refine(
      (val) => !FORBIDDEN_OBJECT_KEYS.includes(val.trim().toLowerCase() as (typeof FORBIDDEN_OBJECT_KEYS)[number]),
      { message: 'Sheet name cannot match prototype properties (__proto__, constructor, prototype)' }
    )
  ```
- **Guarantees**:
  - Rejects malicious sheet names regardless of case (`__proto__`, `__PROTO__`, `Constructor`, `PROTOTYPE`).
  - Rejects malicious sheet names with leading or trailing whitespace (`"  __proto__  "`, `"\tprototype\n"`).
  - Accepts legitimate sheet names with symbols and whitespace (`"Sheet1"`, `"Q1 2024"`, `"Sales & Marketing"`).

### 2. Workbook Aggregate Row Limit (`SEC-P1-06`)
- **Target**: `packages/contracts/src/workbook.ts` (`WorkbookModelSchema`)
- **Implementation**:
  Added an aggregate row refinement to `WorkbookModelSchema`:
  ```ts
  .refine(
    (wb) =>
      wb.sheets.reduce((acc, s) => acc + s.rowCount, 0) <= MAX_ROWS &&
      wb.sheets.reduce((acc, s) => acc + s.rows.length, 0) <= MAX_ROWS,
    { message: `Total workbook rows across all sheets cannot exceed ${MAX_ROWS}` }
  )
  ```
- **Guarantees**:
  - Ensures a multi-sheet workbook cannot bypass the `MAX_ROWS` limit (200,000) by splitting oversized data across multiple sheets (e.g. 5 sheets of 100,000 rows each = 500,000 rows).
  - Validates both `rowCount` and `rows.length` across all sheets in the workbook.

---

## 3. Automated Test Coverage

1. **Unit Tests (`packages/contracts/test/contracts.test.ts`)**:
   - `rejects forbidden prototype pollution keys in SheetModel name`: Verifies acceptance of normal sheet names and rejection of `__proto__`, `__PROTO__`, `  __proto__  `, `constructor`, `Constructor`, ` CONSTRUCTOR `, `prototype`, `Prototype`, `\tprototype\n`.
   - `enforces total workbook rows across all sheets cannot exceed MAX_ROWS (200,000)`: Verifies acceptance of 2 sheets of 100,000 rows ($100k + 100k \le 200k$) and rejection of sheets totaling 210,000 rows ($120k + 90k > 200k$).

2. **Adversarial Tests (`packages/contracts/test/adversarial.test.ts`)**:
   - `rejects prototype pollution keys in SheetModel name`: Added to `1. Prototype Pollution Vectors`.
   - `rejects workbooks with aggregate row count exceeding MAX_ROWS (200,000)`: Added to `3. Oversized Payloads & Limit Enforcement`.

---

## 4. Verification

- `pnpm --filter @unsheet/contracts test`:
  - 3 test files (`src/index.test.ts`, `test/contracts.test.ts`, `test/adversarial.test.ts`)
  - 70 tests passed (100% pass)
- `pnpm --filter @unsheet/contracts build`:
  - Strict typecheck passed (`tsc --noEmit`)
- `pnpm exec eslint packages/contracts`:
  - 0 errors, 0 warnings
