# Phase 3 Query Engineer Handoff

## 1. Executive Summary

Phase 3 Query Engine and DuckDB Integration for Unsheet is fully implemented, tested, and verified on branch `agent/query/phase3-duckdb`. 

All deliverables from the task brief (`docs/briefs/phase3-query.md`) have been implemented:
1. **Query Planner (`packages/engine/src/query/planner.ts`)**: Generates contract-compliant `QueryPlan` definitions from any `WidgetSpec` (KPI, Line, Bar, Donut, Table, Pivot) and `SheetModel` / `SheetProfile`, handling filter bindings, active filters, and table resolution.
2. **SQL Compiler (`packages/engine/src/query/sql.ts`)**: Compiles `QueryPlan` into deterministic, injection-proof `SafeSqlQuery` strings with identifier quoting, string literal escaping, 6 aggregation functions, and 14 filter operators.
3. **AST / Allowlist Safety Validation (`packages/engine/src/query/validation.ts`)**: Validates query plans against sheet schemas, strictly enforcing table and column allowlists, forbidding administrative keywords, and preventing unauthorized schema access.
4. **Pure TypeScript In-Memory Execution Engine (`packages/engine/src/query/memory.ts`)**: Headless, zero-WASM execution engine running directly against `SheetModel.rows` (filtering, grouping, aggregating, sorting, pagination) for fast Node testing and worker fallback.
5. **In-Browser DuckDB-WASM Singleton (`apps/web/lib/query/duckdb.ts`)**: Browser singleton for DuckDB-WASM with Apache Arrow table ingestion, timed query execution with cancellation, BigInt serialization safeguards, and mapping to `QueryResult`.
6. **Comprehensive Test Suite (`packages/engine/test/query/` & `apps/web/test/query/`)**: 4 unit test suites covering the engine modules plus property testing with `fast-check` and browser integration tests.
7. **Monorepo Integration & Verification**: Clean exports from `@unsheet/engine`, zero TypeScript errors, zero ESLint errors, and clean passing of `pnpm verify` (all 6 steps).

---

## 2. Delivered Modules & Implementation Details

### A. Query Planner (`packages/engine/src/query/planner.ts`)
- **`buildWidgetQueryPlan(sheet, widget, activeFilters?)`**:
  - Maps all 6 widget types:
    - **KPI**: Single aggregation on target measure with `limit: 1`.
    - **Line**: Time dimension, measure aggregations, `GROUP BY` time, ordered by time `asc`.
    - **Bar**: Dimension, measure aggregations, `GROUP BY` dimension, sort by value `desc` or label `asc`, `limit`.
    - **Donut**: Dimension, measure aggregation, `GROUP BY` dimension, order by measure `desc`, `limit` (max slices).
    - **Table**: Selected column projections, `defaultSort` order, `pageSize` limit, offset pagination.
    - **Pivot**: Combined row and column dimensions, measure aggregations (with alias disambiguation for multi-aggregations on identical measures), order by row dimensions `asc`.
  - Merges widget-specific filters and active global dashboard filters respecting `widget.filterBindings`.
  - Normalizes filter formats: primitive values (`eq`), array values (`in`), null values (`is_null`), and explicit filter operator objects.
  - Conforms to and validates with `QueryPlanSchema.parse()`.
- **`getSheetTableName(sheet)`**:
  - Deterministically extracts and sanitizes sheet name/ID into a valid `SafeIdentifier`.

### B. SQL Compiler (`packages/engine/src/query/sql.ts`)
- **`compileQueryPlanToSql(plan: QueryPlan): SafeSqlQuery`**:
  - Quotes all identifiers with double quotes (`"col_name"`) using `quoteIdentifier`, strictly validating against `SafeIdentifierSchema` to eliminate SQL injection vectors.
  - Escapes primitive literals with `escapeSqlLiteral` (strings escaped as `''`, booleans as `TRUE`/`FALSE`, nulls as `NULL`, finite numbers, and arrays as tuples).
  - Rejects non-finite numbers (`NaN`, `Infinity`, `-Infinity`).
  - Implements all 6 aggregation functions: `sum`, `avg`, `count`, `min`, `max`, and `distinctCount` (`COUNT(DISTINCT "col")`).
  - Implements all 14 filter operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `between`, `contains`, `starts_with`, `ends_with`, `is_null`, and `is_not_null`.
  - Generates deterministic SQL and validates output through `SafeSqlQuerySchema.parse()`.

### C. AST & Allowlist Safety Validation (`packages/engine/src/query/validation.ts`)
- **`validateQueryPlanAgainstSheet(plan, sheet): QueryPlanValidationResult`**:
  - Validates `plan.table` against allowlisted table names for the target sheet (including raw and sanitized identifiers).
  - Validates that all columns in `dimensions`, `select`, `aggregations`, `filters`, and `orderBy` belong strictly to `sheet.columns` (or `sheet.columnProfiles`).
  - Permits aggregation aliases in `orderBy` clauses while ensuring unallowlisted column names are rejected.
  - Forbids dangerous SQL keywords (`DROP`, `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CREATE`, `COPY`, `ATTACH`, `DETACH`, `INSTALL`, `LOAD`, `PRAGMA`) from being used as identifiers.
  - Validates limit (<= 50000) and offset (>= 0) constraints.

### D. In-Memory Query Engine (`packages/engine/src/query/memory.ts`)
- **`executeQueryInMemory(plan: QueryPlan, sheet: SheetModel): QueryResult`**:
  - Pure TypeScript evaluator executing query plans without needing WebAssembly.
  - Validates query safety upfront via `validateQueryPlanAgainstSheet`.
  - Evaluates all 14 filter operators accurately with type coercion and null-safety.
  - Groups rows across multiple dimensions and computes aggregations (`sum`, `avg`, `min`, `max`, `count`, `distinctCount`).
  - Applies multi-column sorting ascending and descending.
  - Applies pagination (`limit`, `offset`).
  - Measures execution time and returns a validated `QueryResult` passing `QueryResultSchema.parse()`.

### E. In-Browser DuckDB-WASM Singleton (`apps/web/lib/query/duckdb.ts`)
- **`DuckDBManager` / `getDuckDB()`**:
  - Manages in-browser DuckDB-WASM lifecycle with worker and module bundles selected dynamically.
  - Guarded against SSR/Node execution (`typeof window === 'undefined'`).
- **`registerSheetTable(sheet, tableName?)`**:
  - Ingests `SheetModel.rows` into DuckDB tables using Apache Arrow (`arrow.tableFromJSON`) and `conn.insertArrowTable`.
- **`executeDuckDBQuery(sql, options?)`**:
  - Validates SQL upfront against `SafeSqlQuerySchema`.
  - Executes queries with timeout (default 5000ms), calling `conn.cancelSent()` on timeout.
- **`arrowTableToQueryResult(table, queryId?, executionTimeMs?)`**:
  - Maps Arrow record batches to `QueryResult`.
  - Safely converts Arrow `BigInt` (e.g. from `COUNT`) to numbers to prevent JSON serialization errors in React.

---

## 3. Test Coverage & Verification

### Test Suites Added:
1. `packages/engine/test/query/planner.test.ts` (16 tests):
   - Verified plan generation for KPI, Line, Bar, Donut, Table, and Pivot widgets.
   - Verified filter merging, bound vs. unbound filters, and multiple filter input formats.
   - Verified interoperability with both `SheetModel` and `SheetProfile`.
2. `packages/engine/test/query/sql.test.ts` (31 tests):
   - Unit tests for identifier quoting and prototype injection rejection.
   - Unit tests for literal escaping and non-finite rejection.
   - Unit tests for all 6 aggregation functions and all 14 filter operators.
   - Property-based testing with `fast-check` (100 runs) asserting all generated valid `QueryPlan` compile to valid `SafeSqlQuery`.
3. `packages/engine/test/query/validation.test.ts` (10 tests):
   - Verified rejection of unknown columns in dimensions, select, aggregations, filters, orderBy.
   - Verified rejection of unallowlisted tables and forbidden SQL keywords.
   - Verified acceptance of aggregation aliases in orderBy.
4. `packages/engine/test/query/memory.test.ts` (10 tests):
   - Verified numerical accuracy of aggregations and filtering against synthetic fixture data.
   - Verified multi-dimension grouping, sorting, and pagination.
5. `apps/web/test/query/duckdb.test.ts` (4 tests):
   - Verified Arrow table to `QueryResult` mapping, BigInt conversion, and browser environment guard.

### Monorepo Verification (`pnpm verify`):
- **1/6 Linting**: ESLint + Security Plugin passed with 0 errors.
- **2/6 Strict Typechecking**: All 5 workspaces (`@unsheet/contracts`, `@unsheet/engine`, `@unsheet/fixtures`, `@unsheet/web`) passed `tsc --noEmit` with 0 errors.
- **3/6 Automated Tests**: 31 test files passed, 535 tests passed cleanly across the workspace.
- **4/6 Workspace Build**: Clean production build including Next.js 15 static page generation.
- **5/6 Secret Scanning**: Clean, 0 secrets detected.
- **6/6 Security Audit**: Clean, 0 high/critical vulnerabilities.

---

## 4. Guidance for Downstream Agents

### For `frontend-engineer`:
- **Query Planning**:
  Use `buildWidgetQueryPlan(sheet, widget, activeFilters)` from `@unsheet/engine` to turn any dashboard widget and active filter state into an executable `QueryPlan`.
- **Query Execution**:
  - In browser client components:
    ```typescript
    import { DuckDBManager } from '@/lib/query/duckdb';
    import { compileQueryPlanToSql } from '@unsheet/engine';

    // 1. Register sheet table once when workbook is loaded:
    await DuckDBManager.registerSheetTable(sheet);

    // 2. Generate SQL and execute:
    const sql = compileQueryPlanToSql(plan);
    const result = await DuckDBManager.executeQuery(sql, { timeoutMs: 5000 });
    ```
  - In unit tests, web workers, or SSR fallback:
    ```typescript
    import { executeQueryInMemory } from '@unsheet/engine';

    const result = executeQueryInMemory(plan, sheet);
    ```
- **Serialization Safety**:
  Query results returned from both `DuckDBManager` and `executeQueryInMemory` are guaranteed to conform to `QueryResultSchema`, have standard JavaScript primitives (no raw BigInts), and can be passed directly to React components and Recharts charts.
