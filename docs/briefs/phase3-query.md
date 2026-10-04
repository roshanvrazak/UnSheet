# Phase 3 Task Brief: Query Engine & DuckDB Integration

## Agent
`query-engineer`

## Branch
`agent/query/phase3-duckdb`

## Goal
Implement the query planner, SQL generator, query validator, and query execution engine in `packages/engine/src/query/` and `apps/web/lib/query/`.

## Input Contracts
- `@unsheet/contracts`:
  - `QueryPlanSchema`, `QueryPlan`
  - `QueryResultSchema`, `QueryResult`
  - `SafeSqlQuerySchema`, `SafeSqlQuery`
  - `QueryFilterSchema`, `QueryAggregationSchema`, `QueryOrderBySchema`
  - `DashboardSpecSchema`, `WidgetSpecSchema` (KPI, Line, Bar, Donut, Table, Pivot)
  - `SheetModelSchema`, `SheetModel`
  - `SheetProfileSchema`, `SheetProfile`

## Owned Paths
- `packages/engine/src/query/**`
- `apps/web/lib/query/**`
- `packages/engine/test/query/**`
- `apps/web/test/query/**` (if applicable)

## Acceptance Criteria
1. **Query Planner (`packages/engine/src/query/planner.ts`)**:
   - `buildWidgetQueryPlan(sheet: SheetModel | SheetProfile, widget: WidgetSpec, activeFilters?: FilterValueMap): QueryPlan`
   - Maps each widget type (KPI, LineChart, BarChart, DonutChart, Table, PivotTable) into a valid `QueryPlan`:
     - `kpi`: single aggregation on target measure, applying bound filters.
     - `line`: time column dimension (with date truncation), measure aggregation, group by time, order by time asc.
     - `bar`: dimension column, measure aggregation, group by dimension, order by measure desc or dimension asc, limit.
     - `donut`: dimension column, measure aggregation, group by dimension, limit (e.g. 10).
     - `table`: selected columns, order by, limit & offset pagination.
     - `pivot`: row and column dimensions, measure aggregations, group by dimensions.
   - Merges widget-specific filters and global filters bound via `filterBindings`.
   - Returns a `QueryPlan` that passes `QueryPlanSchema.parse()`.

2. **SQL Generator (`packages/engine/src/query/sql.ts`)**:
   - `compileQueryPlanToSql(plan: QueryPlan): SafeSqlQuery`
   - Quotes identifiers with double quotes (`"col_name"`) using `SafeIdentifier` to strictly prevent SQL injection.
   - Maps aggregations: `sum`, `avg`, `count`, `min`, `max`, `distinctCount` (`COUNT(DISTINCT "col")`).
   - Maps filter operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `between`, `contains`, `starts_with`, `ends_with`, `is_null`, `is_not_null`.
   - String literal escaping (quotes escaped as `''`).
   - Emits clean, deterministic SQL passing `SafeSqlQuerySchema.parse()`.

3. **AST / Allowlist Safety Validation (`packages/engine/src/query/validation.ts`)**:
   - `validateQueryPlanAgainstSheet(plan: QueryPlan, sheet: SheetModel | SheetProfile): { valid: boolean; errors: string[] }`
   - Checks that all referenced table and column keys are strictly members of the sheet's columns.
   - Rejects unallowlisted columns or tables.

4. **Node / Worker In-Memory Execution Engine (`packages/engine/src/query/memory.ts`)**:
   - Pure TypeScript in-memory evaluator: evaluates `QueryPlan` directly against `SheetModel.rows` (filtering, grouping, aggregating, sorting, pagination).
   - Produces `QueryResult` matching `QueryResultSchema`.
   - Enables fast, headless, zero-WASM testing in Node test suites and fallback execution in workers.

5. **DuckDB-WASM Browser Integration (`apps/web/lib/query/duckdb.ts`)**:
   - In-browser singleton manager for DuckDB-WASM.
   - Table registration: loads `SheetModel` rows into DuckDB tables.
   - Execution: runs `SafeSqlQuery` with timeout (e.g. 5000ms).
   - Maps DuckDB Arrow tables to `QueryResult` matching `@unsheet/contracts`.

6. **Comprehensive Tests (`packages/engine/test/query/`)**:
   - Unit tests for `planner.ts`: builds query plans for all 6 widget types + filters.
   - Unit tests for `sql.ts`: verifies compiled SQL against expected syntax and `SafeSqlQuerySchema`.
   - Unit tests for `validation.ts`: rejects unknown columns, invalid identifiers, forbidden keywords.
   - Integration tests with `memory.ts`: executes query plans on synthetic fixture data and verifies numerical accuracy of aggregations (sum, avg, count, min, max).
   - Fast-check property test: arbitrary valid `QueryPlan` compiles to valid `SafeSqlQuery`.

7. **Verification**:
   - All tests pass: `pnpm --filter @unsheet/engine test`.
   - Monorepo builds cleanly.
   - Handoff note at `docs/handoffs/phase3-query-engineer.md`.
