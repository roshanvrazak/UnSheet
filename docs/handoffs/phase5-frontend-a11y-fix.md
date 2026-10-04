# Phase 5 Frontend Accessibility Fix Handoff

## Summary of Changes
- Updated `apps/web/components/chat/AskYourDataDrawer.tsx` to include `aria-expanded={Boolean(showSqlMap[msg.id])}` and `aria-label="Toggle SQL query preview"` on the generated SQL toggle button.
- Verified accessibility and regression tests via `pnpm --filter @unsheet/web test` and `pnpm lint --quiet`.

## Verification Status
- All 55 tests passed successfully.
- Linting checks passed without errors.
