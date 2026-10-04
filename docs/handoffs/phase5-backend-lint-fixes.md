# Handoff Note: Phase 5 Backend Lint Fixes

## Overview
Successfully resolved all 8 ESLint errors across the owned backend paths (`apps/web/app/api/**`, `apps/web/lib/llm/**`).

## Summary of Changes
1. **`apps/web/app/api/query/ask/route.ts`**:
   - Imported `QueryPlan` and `WidgetSpec` from `@unsheet/contracts`.
   - Replaced `any` on `queryPlanResult` and `widgetResult` with proper types (`QueryPlan | undefined` and `WidgetSpec | undefined`).
   - Replaced `catch (error: any)` with `catch (error: unknown)` and added type guard check (`error instanceof Error ? error.message : 'Internal server error'`).
2. **`apps/web/app/api/spec/refine/route.ts`**:
   - Removed unused `history` parameter from destructuring of parse results.
   - Replaced `catch (error: any)` with `catch (error: unknown)` and safe error message extraction.
3. **`apps/web/lib/llm/fallback.ts`**:
   - Imported `WidgetSpec` and `QueryPlan` from `@unsheet/contracts`.
   - Replaced `any` in `deterministicAskQuery` return type for `queryPlan` and `suggestedWidget` with `QueryPlan | undefined` and `WidgetSpec | undefined`.
   - Replaced `let widget: any = null;` with `let widget: WidgetSpec | null = null;`.

## Verification Results
- Ran `pnpm lint --quiet`: **0 errors, 0 warnings**.
- Ran `pnpm --filter @unsheet/web test`: **12 test files passed, 52 tests passed successfully**.
