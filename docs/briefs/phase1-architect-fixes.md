# Task Brief: Phase 1 Contract Hardening & Refinements

**Agent**: `architect`  
**Branch**: `agent/architect/phase1-contract-fixes`  
**Owned Paths**: `packages/contracts/**`

## Goal
Implement contract hardening in `packages/contracts` arising from the Phase 1 independent reviews (`security-phase1.md`, `code-review-phase1.md`, `adversarial-phase1.md`).

## Requirements
1. **Sheet Name Prototype Pollution Guard (`ADV-P1-05`, `ADV-P1-06`, `SEC-P1-04`)**:
   - In `packages/contracts/src/workbook.ts`, refine `SheetModelSchema.shape.name` to reject strings that match `FORBIDDEN_OBJECT_KEYS` (`__proto__`, `constructor`, `prototype`), even when whitespace-trimmed or case-insensitive:
     ```ts
     name: z
       .string()
       .min(1, 'Sheet name must not be empty')
       .max(128, 'Sheet name exceeds maximum length of 128 characters')
       .refine(
         (val) => !FORBIDDEN_OBJECT_KEYS.includes(val.trim().toLowerCase() as any),
         { message: 'Sheet name cannot match prototype properties (__proto__, constructor, prototype)' }
       )
     ```

2. **Workbook Aggregate Row Limit (`SEC-P1-06`)**:
   - In `packages/contracts/src/workbook.ts`, refine `WorkbookModelSchema` to ensure total rows across all sheets cannot exceed `MAX_ROWS` (200,000):
     ```ts
     .refine(
       (wb) => wb.sheets.reduce((acc, s) => acc + s.rowCount, 0) <= MAX_ROWS,
       { message: `Total workbook rows across all sheets cannot exceed ${MAX_ROWS}` }
     )
     ```

3. **Export Identifier Sanitizer Helper (Optional / Recommended)**:
   - In `packages/contracts/src/common.ts`, ensure `SafeIdentifierSchema` and `SafeEntityIdSchema` remain the gold standard.
   - If useful, export a pure utility function or ensure contract tests verify the new refinements.

4. **Contract Tests**:
   - In `packages/contracts/test/contracts.test.ts` (or `adversarial.test.ts`), add test cases asserting:
     - Rejection of sheet named `__proto__`, `constructor`, `prototype` (and case variants `Constructor`, ` __proto__ `).
     - Acceptance of normal sheet names (`Sheet1`, `Q1 2024`, `Sales & Marketing`).
     - Rejection of workbook with total row count exceeding 200,000 across multiple sheets.

## Verification
Run:
`pnpm --filter @unsheet/contracts test`
`pnpm --filter @unsheet/contracts build`

## Handoff
Write report to `docs/handoffs/phase1-architect-fixes.md` and commit to `agent/architect/phase1-contract-fixes`.
