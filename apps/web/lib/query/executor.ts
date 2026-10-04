import type {
  QueryResult,
  SheetModel,
  WidgetSpec,
} from '@unsheet/contracts';
import {
  buildWidgetQueryPlan,
  compileQueryPlanToSql,
  executeQueryInMemory,
} from '@unsheet/engine';
import { executeDuckDBQuery } from './duckdb.js';

export interface ExecuteQueryOptions {
  activeFilters?: Record<string, unknown> | undefined;
  useDuckDB?: boolean | undefined;
}

/**
 * Executes a query for a given widget against a SheetModel.
 * Prioritizes fast, synchronous in-memory execution, with transparent fallback
 * and optional DuckDB-WASM execution in browser environments.
 * Strictly guarantees returned payload conforms to QueryResultSchema.
 */
export async function executeWidgetQuery(
  sheet: SheetModel,
  widget: WidgetSpec,
  options?: ExecuteQueryOptions
): Promise<QueryResult> {
  const { activeFilters, useDuckDB = false } = options ?? {};

  // 1. Build and validate the QueryPlan for this widget
  const plan = buildWidgetQueryPlan(sheet, widget, activeFilters);

  // 2. If DuckDB execution is requested and running in browser, attempt DuckDB query
  if (useDuckDB && typeof window !== 'undefined') {
    try {
      const sql = compileQueryPlanToSql(plan);
      return await executeDuckDBQuery(sql, { queryId: plan.id });
    } catch {
      // Fallback seamlessly to memory query if DuckDB table is not loaded or fails
    }
  }

  // 3. Guaranteed in-memory execution via @unsheet/engine
  return executeQueryInMemory(plan, sheet);
}
