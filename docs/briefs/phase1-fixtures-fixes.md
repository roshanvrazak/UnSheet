# Task Brief: Phase 1 Fixtures Disambiguation & Sanitizer Alignment

**Agent**: `fixtures-engineer`  
**Branch**: `agent/fixtures/phase1-fixes`  
**Owned Paths**: `packages/fixtures/**`

## Goal
Fix header disambiguation collision logic and align identifier sanitization rules with `@unsheet/engine` based on code review findings `REV-P1-11` and `REV-P1-12`.

## Requirements
1. **Header Disambiguation Collision Bug (`REV-P1-11`)**:
   - In `packages/fixtures/src/generators/utils.ts`:
     Fix `disambiguateHeaders` so that if an input contains `['user', 'user', 'user_1']`, the second `'user'` does not collide with existing `'user_1'`.
     Use a `while (seen.has(candidateKey))` loop similar to engine sanitization to ensure absolute uniqueness without collisions.
   - Use `SafeIdentifierSchema.parse()` rather than unchecked `as SafeIdentifier` casts.

2. **Sanitizer Rule Alignment (`REV-P1-12`)**:
   - In `packages/fixtures/src/generators/utils.ts`:
     Align prefixing rules with `packages/engine/src/normalise/sanitise.ts` (or import from a shared contracts/engine helper if appropriate) so that leading digits and prototype keys follow identical conventions (e.g. `_2024_sales` and `safe___proto__`).
   - If golden baselines need regenerating to match the aligned identifiers, regenerate and verify.

3. **Golden Workbook Verification**:
   - In `packages/fixtures/src/index.ts`, validate loaded golden baselines against `WorkbookModelSchema` safely.

4. **Testing**:
   - Run `pnpm --filter @unsheet/fixtures test`. All fixtures tests must pass 100%.

## Handoff
Write report to `docs/handoffs/phase1-fixtures-fixes.md` and commit to `agent/fixtures/phase1-fixes`.
