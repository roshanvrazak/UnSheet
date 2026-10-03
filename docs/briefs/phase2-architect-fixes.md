# Task Brief: Phase 2 Contract Refinements

**Agent**: `architect`  
**Branch**: `agent/architect/phase2-contract-refinements`  
**Owned Paths**: `packages/contracts/**`

## Goal
Implement contract refinements arising from Phase 2 independent reviews (`security-phase2.md`, `code-review-phase2.md`, `adversarial-phase2.md`).

## Requirements
1. **SheetProfile Sheet Name Prototype Guard (`SEC-P2-03`)**:
   - In `packages/contracts/src/profile.ts`, refine `SheetProfileSchema.shape.sheetName` to reject forbidden prototype pollution keys (`__proto__`, `constructor`, `prototype`), matching `SheetModelSchema.shape.name`:
     ```ts
     sheetName: z
       .string()
       .min(1, 'Sheet name must not be empty')
       .max(128, 'Sheet name exceeds maximum length of 128 characters')
       .refine(
         (val) => !FORBIDDEN_OBJECT_KEYS.includes(val.trim().toLowerCase() as any),
         { message: 'Sheet name cannot match prototype properties (__proto__, constructor, prototype)' }
       )
     ```

2. **Official Schemas for Joins and Workbook Profile (`REV-P2-03`)**:
   - In `packages/contracts/src/profile.ts`, define and export:
     - `JoinCandidateSchema`:
       ```ts
       export const JoinCandidateSchema = z.object({
         sourceSheet: z.string().min(1).max(128),
         sourceColumn: SafeIdentifierSchema,
         targetSheet: z.string().min(1).max(128),
         targetColumn: SafeIdentifierSchema,
         confidence: z.number().min(0).max(1),
         overlapRatio: z.number().min(0).max(1),
         sampleMatches: z.array(z.string().max(64)).max(10),
       });
       export type JoinCandidate = z.infer<typeof JoinCandidateSchema>;
       ```
     - `WorkbookProfileSchema`:
       ```ts
       export const WorkbookProfileSchema = z.object({
         sheets: z.array(SheetProfileSchema),
         crossSheetJoins: z.array(JoinCandidateSchema),
       });
       export type WorkbookProfile = z.infer<typeof WorkbookProfileSchema>;
       ```
   - Export them from `packages/contracts/src/index.ts`.

3. **Contract Tests**:
   - In `packages/contracts/test/contracts.test.ts`, add test cases asserting:
     - Rejection of sheetName with `__proto__`, `constructor`, `prototype` in `SheetProfileSchema`.
     - Valid validation of `JoinCandidateSchema` and `WorkbookProfileSchema`.

## Verification
- `pnpm --filter @unsheet/contracts test`
- `pnpm --filter @unsheet/contracts build`

## Handoff
Write report to `docs/handoffs/phase2-architect-fixes.md` and commit changes to `agent/architect/phase2-contract-refinements`.
