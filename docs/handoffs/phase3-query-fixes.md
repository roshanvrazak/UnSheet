# Phase 3 Query Engine & Web Query Fixes Handoff Note

**Author**: Query Engineer (`agent/query/phase3-fixes`)  
**Date**: October 4, 2026  
**Status**: Completed & Verified (`pnpm test` passed 36/36 test files, 585/585 tests)

---

## Summary of Remediations

### 1. `packages/engine/src/query/memory.ts`
- **SEC-P3-02 & ADV-P3-11**: Replaced spread-based `Math.min(...numValues)` and `Math.max(...numValues)` with simple iterative `for` loops. This prevents `RangeError: Maximum call stack size exceeded` when executing aggregations on large datasets (>120k rows).
- **SEC-P3-09**: Replaced `dimValues.join(':::')` with `JSON.stringify(dimValues)` for composite dimension grouping keys to prevent delimiter collisions.
- **ADV-P3-12**: Implemented `safeToString(val: unknown): string` checking `typeof val === 'object' && val !== null && !('toString' in val)` (falling back safely to `JSON.stringify` or `[object Object]`) to prevent `Object.create(null)` from throwing `TypeError` during filter matching and comparison.

### 2. `packages/engine/src/query/sql.ts`
- **ADV-P3-06**: In `compileQueryPlanToSql`, validated and strictly formatted `ORDER BY` direction using `o.direction?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'` instead of arbitrary string interpolation `${o.direction.toUpperCase()}`.
- **SEC-P3-10 & REV-P3-07**: In `compileFilter`, for operators `contains`, `starts_with`, `ends_with`, escaped backslashes (`\\`), SQL LIKE wildcards (`\%`, `\_`), and single quotes (`''`), and appended `ESCAPE '\\'` (e.g. `LIKE '%pattern%' ESCAPE '\\'`).

### 3. `packages/engine/src/query/planner.ts`
- **ADV-P3-15**: In `normalizeFilterEntry`, added an explicit check against `allowedColKeys`: if `allowedColKeys.size > 0` and `!allowedColKeys.has(columnKey)`, the filter is dropped/filtered out.
- **REV-P3-04**: In `buildTablePlan`, supported a larger default limit (`Math.min(sheet.rows?.length || 10000, 10000)`) so client-side pagination can view all rows up to 10k rows.

### 4. `apps/web/lib/query/duckdb.ts` & `apps/web/lib/query/executor.ts`
- **SEC-P3-04 & REV-P3-03**: Added a promise-chain / FIFO mutex queue (`runWithDuckDBMutex`) in `duckdb.ts` to serialize queries against the single DuckDB connection (`conn`), preventing concurrency deadlocks when multiple dashboard widgets execute simultaneously.
- **Execution Integration**: Updated `executeWidgetQuery` in `executor.ts` to properly invoke `registerSheetTable(sheet)` before executing DuckDB queries.

### 5. Verification & Test Suite
- Updated `packages/engine/test/adversarial/phase3_adversarial.test.ts` where adversarial tests previously asserted vulnerable behavior (throwing errors on `copy` columns, stack overflow, type errors, or unescaped LIKE wildcards) to now successfully assert hardened, secure, and robust execution.
- Ran `pnpm test` across the entire workspace: **36 test files passed, 585 tests passed**.
