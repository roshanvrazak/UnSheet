# Frontend Error Boundaries and E2E Tests Handoff

## Summary of Changes

1. **Top-Level Error Boundaries**:
   - Implemented `apps/web/app/error.tsx`: Client component receiving `{ error, reset }`, logging errors via `useEffect`, providing an accessible error recovery card (`role="alert"`), error message display, "Try Again" (`reset()`), and "Reload Page" (`window.location.reload()`).
   - Implemented `apps/web/app/global-error.tsx`: Root error boundary client component wrapping content in `<html>` and `<body>` with a robust recovery UI and dark theme support.

2. **Semantic HTML & WCAG AA Accessibility**:
   - Updated `apps/web/app/page.tsx` line 251: Changed `<span className="text-lg font-black tracking-tight text-slate-900">Unsheet</span>` to `<h1 className="text-lg font-black tracking-tight text-slate-900">Unsheet</h1>`.

3. **E2E Tests Update (`e2e/dashboard.spec.ts`)**:
   - Replaced non-existent sample workbook names ("Financials", "SaaS Metrics", "Logistics") with the actual sample workbooks defined in `apps/web/lib/sample-workbooks.ts`:
     - Test 1: Click "BOQ & Quotes".
     - Test 2: Click "Project Pipeline".
     - Test 3: Click "Supplier Lead Times".
     - Test 4: Click "BOQ & Quotes".
     - Test 5: Click "Project Pipeline".
   - Verified `locator('h1')` finding "Unsheet" passes cleanly.

4. **Verification**:
   - Unit tests passed successfully (`pnpm --filter @unsheet/web test`).
   - Typechecking passed successfully (`pnpm --filter @unsheet/web typecheck`).
   - Linting passed successfully (`pnpm lint --quiet`).
