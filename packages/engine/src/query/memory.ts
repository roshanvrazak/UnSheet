import type {
  QueryAggregation,
  QueryFilter,
  QueryPlan,
  QueryResult,
  QueryResultColumn,
  SafeIdentifier,
  SheetModel,
} from '@unsheet/contracts';
import { QueryResultSchema } from '@unsheet/contracts';
import { validateQueryPlanAgainstSheet } from './validation.js';

/**
 * Checks whether a single row satisfies a filter condition.
 */
function matchesFilter(row: Record<string, unknown>, filter: QueryFilter): boolean {
  const cell = row[filter.columnKey];
  const target = filter.value;

  switch (filter.operator) {
    case 'eq': {
      if (target === null) {
        return cell === null || cell === undefined;
      }
      if (cell === target) {
        return true;
      }
      if (cell !== null && cell !== undefined && target !== null && target !== undefined) {
        return String(cell) === String(target);
      }
      return false;
    }

    case 'neq': {
      if (target === null) {
        return cell !== null && cell !== undefined;
      }
      if (cell === target) {
        return false;
      }
      if (cell !== null && cell !== undefined && target !== null && target !== undefined) {
        return String(cell) !== String(target);
      }
      return true;
    }

    case 'gt': {
      if (cell === null || cell === undefined) return false;
      const numCell = Number(cell);
      const numTarget = Number(target);
      if (!Number.isNaN(numCell) && !Number.isNaN(numTarget)) {
        return numCell > numTarget;
      }
      return String(cell) > String(target);
    }

    case 'gte': {
      if (cell === null || cell === undefined) return false;
      const numCell = Number(cell);
      const numTarget = Number(target);
      if (!Number.isNaN(numCell) && !Number.isNaN(numTarget)) {
        return numCell >= numTarget;
      }
      return String(cell) >= String(target);
    }

    case 'lt': {
      if (cell === null || cell === undefined) return false;
      const numCell = Number(cell);
      const numTarget = Number(target);
      if (!Number.isNaN(numCell) && !Number.isNaN(numTarget)) {
        return numCell < numTarget;
      }
      return String(cell) < String(target);
    }

    case 'lte': {
      if (cell === null || cell === undefined) return false;
      const numCell = Number(cell);
      const numTarget = Number(target);
      if (!Number.isNaN(numCell) && !Number.isNaN(numTarget)) {
        return numCell <= numTarget;
      }
      return String(cell) <= String(target);
    }

    case 'in': {
      if (!Array.isArray(target) || target.length === 0) {
        return false;
      }
      return target.some((item) => {
        if (item === cell) return true;
        if (cell !== null && cell !== undefined && item !== null && item !== undefined) {
          return String(item) === String(cell);
        }
        return false;
      });
    }

    case 'not_in': {
      if (!Array.isArray(target) || target.length === 0) {
        return true;
      }
      return !target.some((item) => {
        if (item === cell) return true;
        if (cell !== null && cell !== undefined && item !== null && item !== undefined) {
          return String(item) === String(cell);
        }
        return false;
      });
    }

    case 'between': {
      if (!Array.isArray(target) || target.length < 2 || cell === null || cell === undefined) {
        return false;
      }
      const numCell = Number(cell);
      const min = Number(target[0]);
      const max = Number(target[1]);
      if (!Number.isNaN(numCell) && !Number.isNaN(min) && !Number.isNaN(max)) {
        return numCell >= min && numCell <= max;
      }
      const strCell = String(cell);
      return strCell >= String(target[0]) && strCell <= String(target[1]);
    }

    case 'contains': {
      if (cell === null || cell === undefined) return false;
      return String(cell).toLowerCase().includes(String(target ?? '').toLowerCase());
    }

    case 'starts_with': {
      if (cell === null || cell === undefined) return false;
      return String(cell).toLowerCase().startsWith(String(target ?? '').toLowerCase());
    }

    case 'ends_with': {
      if (cell === null || cell === undefined) return false;
      return String(cell).toLowerCase().endsWith(String(target ?? '').toLowerCase());
    }

    case 'is_null':
      return cell === null || cell === undefined;

    case 'is_not_null':
      return cell !== null && cell !== undefined;

    default:
      return true;
  }
}

/**
 * Computes an aggregation function over a set of rows.
 */
function computeAggregation(
  rows: Array<Record<SafeIdentifier, unknown>>,
  agg: QueryAggregation
): unknown {
  const { columnKey, function: fn } = agg;
  const rawValues = rows
    .map((r) => r[columnKey])
    .filter((v) => v !== null && v !== undefined);

  switch (fn) {
    case 'count':
      return rawValues.length;

    case 'distinctCount': {
      const distinctSet = new Set(
        rawValues.map((v) => (typeof v === 'object' ? JSON.stringify(v) : v))
      );
      return distinctSet.size;
    }

    case 'sum': {
      const numValues = rawValues
        .map((v) => (typeof v === 'number' ? v : Number(v)))
        .filter((n) => !Number.isNaN(n));
      if (numValues.length === 0) return null;
      return numValues.reduce((a, b) => a + b, 0);
    }

    case 'avg': {
      const numValues = rawValues
        .map((v) => (typeof v === 'number' ? v : Number(v)))
        .filter((n) => !Number.isNaN(n));
      if (numValues.length === 0) return null;
      return numValues.reduce((a, b) => a + b, 0) / numValues.length;
    }

    case 'min': {
      const numValues = rawValues
        .map((v) => (typeof v === 'number' ? v : Number(v)))
        .filter((n) => !Number.isNaN(n));
      if (numValues.length === 0) {
        if (rawValues.length === 0) return null;
        return rawValues.sort()[0] ?? null;
      }
      return Math.min(...numValues);
    }

    case 'max': {
      const numValues = rawValues
        .map((v) => (typeof v === 'number' ? v : Number(v)))
        .filter((n) => !Number.isNaN(n));
      if (numValues.length === 0) {
        if (rawValues.length === 0) return null;
        return rawValues.sort()[rawValues.length - 1] ?? null;
      }
      return Math.max(...numValues);
    }

    default:
      return null;
  }
}

/**
 * Executes a QueryPlan in-memory against a SheetModel without needing WebAssembly.
 * Guarantees output conforms to QueryResultSchema.
 */
export function executeQueryInMemory(
  plan: QueryPlan,
  sheet: SheetModel
): QueryResult {
  const startTime = performance.now();

  // 1. Safety validation
  const validation = validateQueryPlanAgainstSheet(plan, sheet);
  if (!validation.valid) {
    throw new Error(`Query plan validation failed: ${validation.errors.join('; ')}`);
  }

  // 2. Filtering
  let filteredRows = sheet.rows;
  if (plan.filters && plan.filters.length > 0) {
    filteredRows = filteredRows.filter((row) =>
      plan.filters!.every((filter) => matchesFilter(row, filter))
    );
  }

  // 3. Grouping and Aggregating / Projecting
  let resultRows: Array<Record<SafeIdentifier, unknown>> = [];

  if (plan.dimensions && plan.dimensions.length > 0) {
    // Group By Dimensions
    const groupMap = new Map<
      string,
      {
        sample: Record<SafeIdentifier, unknown>;
        rows: Array<Record<SafeIdentifier, unknown>>;
      }
    >();

    for (const row of filteredRows) {
      const key = plan.dimensions
        .map((dim) => String(row[dim] ?? ''))
        .join(':::');
      let grp = groupMap.get(key);
      if (!grp) {
        grp = { sample: row, rows: [] };
        groupMap.set(key, grp);
      }
      grp.rows.push(row);
    }

    resultRows = Array.from(groupMap.values()).map(({ sample, rows: grpRows }) => {
      const outputRow: Record<SafeIdentifier, unknown> = {};
      for (const dim of plan.dimensions!) {
        outputRow[dim] = sample[dim];
      }
      if (plan.aggregations) {
        for (const agg of plan.aggregations) {
          outputRow[agg.alias] = computeAggregation(grpRows, agg);
        }
      }
      return outputRow;
    });
  } else if (plan.aggregations && plan.aggregations.length > 0) {
    // Ungrouped global aggregations (e.g. KPI)
    const outputRow: Record<SafeIdentifier, unknown> = {};
    for (const agg of plan.aggregations) {
      outputRow[agg.alias] = computeAggregation(filteredRows, agg);
    }
    resultRows = [outputRow];
  } else if (plan.select && plan.select.length > 0) {
    // Projection
    resultRows = filteredRows.map((row) => {
      const outputRow: Record<SafeIdentifier, unknown> = {};
      for (const col of plan.select!) {
        outputRow[col] = row[col];
      }
      return outputRow;
    });
  } else {
    // Select all columns
    resultRows = filteredRows.map((r) => ({ ...r }));
  }

  // 4. Sorting (plan.orderBy)
  if (plan.orderBy && plan.orderBy.length > 0) {
    resultRows.sort((a, b) => {
      for (const order of plan.orderBy!) {
        const valA = a[order.columnKey];
        const valB = b[order.columnKey];

        if (valA === valB) continue;

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        const numA = Number(valA);
        const numB = Number(valB);
        let cmp = 0;
        if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
          cmp = numA < numB ? -1 : 1;
        } else {
          cmp = String(valA).localeCompare(String(valB));
        }

        return order.direction === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }

  // 5. Pagination (offset & limit)
  const offset = plan.offset ?? 0;
  const pagedRows =
    plan.limit !== undefined
      ? resultRows.slice(offset, offset + plan.limit)
      : resultRows.slice(offset);

  // 6. Build Columns metadata
  const columns: QueryResultColumn[] = [];
  const colMap = new Map<string, string>();
  for (const c of sheet.columns) {
    colMap.set(c.key, 'column');
  }

  if (plan.select && plan.select.length > 0) {
    for (const col of plan.select) {
      columns.push({ name: col, type: colMap.get(col) ?? 'string' });
    }
  } else {
    if (plan.dimensions) {
      for (const dim of plan.dimensions) {
        columns.push({ name: dim, type: colMap.get(dim) ?? 'dimension' });
      }
    }
    if (plan.aggregations) {
      for (const agg of plan.aggregations) {
        const isCount = agg.function === 'count' || agg.function === 'distinctCount';
        columns.push({ name: agg.alias, type: isCount ? 'integer' : 'number' });
      }
    }
  }

  if (columns.length === 0 && pagedRows.length > 0) {
    for (const key of Object.keys(pagedRows[0]!)) {
      columns.push({ name: key as SafeIdentifier, type: 'unknown' });
    }
  }

  const executionTimeMs = Math.max(0, Math.round((performance.now() - startTime) * 100) / 100);

  const queryResult: QueryResult = {
    queryId: plan.id,
    columns,
    rows: pagedRows,
    rowCount: pagedRows.length,
    executionTimeMs,
    cached: false,
  };

  return QueryResultSchema.parse(queryResult);
}
