# DevOps Handoff: Fix CSP White Screen Crash in Next.js

## Overview
Successfully resolved the Content Security Policy (CSP) white screen crash caused by Next.js App Router inline hydration scripts (`<script>(self.__next_f=self.__next_f||[]).push(...)</script>`) being blocked by strict `script-src` settings.

## Changes Made
1. **`apps/web/next.config.mjs`**:
   - Added `'unsafe-inline'` back to `script-src` in `securityHeaders` Content-Security-Policy:
     `value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval'; ..."`

2. **`apps/web/test/config.test.ts`**:
   - Updated test assertion from `.not.toContain("'unsafe-inline'")` to `.toContain("'unsafe-inline'")`.
   - Added explanatory comment noting that Next.js App Router requires `'unsafe-inline'` for React hydration scripts unless dynamic nonce middleware is utilized.

3. **`.gitignore`**:
   - Added `playwright-report/` and `test-results/` entries.

4. **Verification**:
   - Ran `pnpm --filter @unsheet/web test test/config.test.ts` successfully.
   - Ran `pnpm test` (all 50 test files and 634 tests passed).
   - Ran `pnpm lint --quiet` successfully with 0 errors/warnings.
