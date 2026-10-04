# Phase 6 Backend Migration Path Fix

## Summary
- Updated `apps/web/test/api/share.test.ts` to use a robust path lookup array (`process.cwd()`, relative fallbacks, and `__dirname`) when locating `supabase/migrations/20261004000000_phase6_shares_and_templates.sql`.
- Verified that running `pnpm test` from the monorepo root passes successfully.
- Verified that running `pnpm lint --quiet` returns 0 errors.
