import type {
  BarChartWidgetSpec,
  DonutChartWidgetSpec,
  KPIWidgetSpec,
  LineChartWidgetSpec,
  PivotTableWidgetSpec,
  QueryAggregation,
  QueryFilter,
  QueryFilterOperator,
  QueryOrderBy,
  QueryPlan,
  SafeEntityId,
  SafeIdentifier,
  SheetModel,
  SheetProfile,
  TableWidgetSpec,
  WidgetSpec,
} from '@unsheet/contracts';
import {
  QueryFilterSchema,
  QueryPlanSchema,
  SafeIdentifierSchema,
} from '@unsheet/contracts';
import { sanitiseHeaderToken } from '../normalise/sanitise.js';

export type FilterValueMap = Record<string, unknown>;

/**
 * Derives a deterministic, contract-safe table identifier for a SheetModel or SheetProfile.
 */
export function getSheetTableName(sheet: SheetModel | SheetProfile): SafeIdentifier {
  const rawName = 'name' in sheet ? sheet.name : sheet.sheetName;
  if (SafeIdentifierSchema.safeParse(rawName).success) {
    return rawName as SafeIdentifier;
  }
  const rawId = 'id' in sheet ? sheet.id : sheet.sheetId;
  if (SafeIdentifierSchema.safeParse(rawId).success) {
    return rawId as SafeIdentifier;
  }
  return sanitiseHeaderToken(rawName, 0) as SafeIdentifier;
}

/**
 * Normalises an unknown filter entry into a valid QueryFilter, if possible.
 */
function normalizeFilterEntry(
  colKeyCandidate: string,
  filterValue: unknown,
  allowedColKeys: Set<string>
): QueryFilter | null {
  if (filterValue === undefined) {
    return null;
  }

  // 1. Resolve target columnKey
  let resolvedColKey: string = colKeyCandidate;

  // Check if filterValue is an object with explicit columnKey
  if (
    typeof filterValue === 'object' &&
    filterValue !== null &&
    'columnKey' in filterValue &&
    typeof (filterValue as { columnKey: unknown }).columnKey === 'string'
  ) {
    resolvedColKey = (filterValue as { columnKey: string }).columnKey;
  } else if (!allowedColKeys.has(resolvedColKey)) {
    if (resolvedColKey.startsWith('filter_')) {
      const stripped = resolvedColKey.slice(7);
      if (allowedColKeys.has(stripped)) {
        resolvedColKey = stripped;
      }
    }
  }

  const validCol = SafeIdentifierSchema.safeParse(resolvedColKey);
  if (!validCol.success) {
    return null;
  }
  const columnKey = validCol.data;

  // 2. Resolve operator and value
  let operator: QueryFilterOperator = 'eq';
  let value: unknown = filterValue;

  if (typeof filterValue === 'object' && filterValue !== null && !Array.isArray(filterValue)) {
    const obj = filterValue as Record<string, unknown>;
    if ('operator' in obj && typeof obj.operator === 'string') {
      operator = obj.operator as QueryFilterOperator;
      value = obj.value;
    }
  } else if (filterValue === null) {
    operator = 'is_null';
    value = null;
  } else if (Array.isArray(filterValue)) {
    operator = 'in';
    value = filterValue;
  }

  const candidate = {
    columnKey,
    operator,
    value,
  };

  const parsed = QueryFilterSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * Merges widget-specific filters with active global filters matching widget.filterBindings.
 */
function resolveMergedFilters(
  sheet: SheetModel | SheetProfile,
  widget: WidgetSpec,
  activeFilters?: FilterValueMap | QueryFilter[]
): QueryFilter[] {
  const mergedFilters: QueryFilter[] = [];
  const seenFilterKeys = new Set<string>();

  const sheetColumns =
    'columns' in sheet
      ? sheet.columns.map((c) => c.key)
      : sheet.columnProfiles.map((c) => c.columnKey);
  const allowedColKeys = new Set<string>(sheetColumns);

  // 1. Check if widget has explicit inline filters (e.g. extension/custom)
  if ('filters' in widget && Array.isArray((widget as { filters?: unknown }).filters)) {
    for (const f of (widget as { filters: unknown[] }).filters) {
      const parsed = QueryFilterSchema.safeParse(f);
      if (parsed.success) {
        const hash = `${parsed.data.columnKey}:${parsed.data.operator}:${JSON.stringify(parsed.data.value)}`;
        if (!seenFilterKeys.has(hash)) {
          seenFilterKeys.add(hash);
          mergedFilters.push(parsed.data);
        }
      }
    }
  }

  // 2. Process activeFilters
  if (!activeFilters) {
    return mergedFilters;
  }

  if (Array.isArray(activeFilters)) {
    for (const f of activeFilters) {
      const parsed = QueryFilterSchema.safeParse(f);
      if (parsed.success) {
        // If filterBindings are defined on widget, filter must match bindings or column
        if (
          widget.filterBindings &&
          widget.filterBindings.length > 0 &&
          !widget.filterBindings.includes(parsed.data.columnKey) &&
          !widget.filterBindings.includes(`filter_${parsed.data.columnKey}` as SafeIdentifier)
        ) {
          continue;
        }
        const hash = `${parsed.data.columnKey}:${parsed.data.operator}:${JSON.stringify(parsed.data.value)}`;
        if (!seenFilterKeys.has(hash)) {
          seenFilterKeys.add(hash);
          mergedFilters.push(parsed.data);
        }
      }
    }
    return mergedFilters;
  }

  // Active filters is Record<string, unknown>
  for (const [filterKey, filterVal] of Object.entries(activeFilters)) {
    if (filterVal === undefined) {
      continue;
    }

    // Check filter bindings if specified on widget
    if (widget.filterBindings && widget.filterBindings.length > 0) {
      const isBound =
        widget.filterBindings.includes(filterKey as SafeIdentifier) ||
        widget.filterBindings.includes(`filter_${filterKey}` as SafeIdentifier) ||
        (filterKey.startsWith('filter_') &&
          widget.filterBindings.includes(filterKey.slice(7) as SafeIdentifier));

      if (!isBound) {
        continue;
      }
    }

    const resolvedFilter = normalizeFilterEntry(filterKey, filterVal, allowedColKeys);
    if (resolvedFilter) {
      const hash = `${resolvedFilter.columnKey}:${resolvedFilter.operator}:${JSON.stringify(resolvedFilter.value)}`;
      if (!seenFilterKeys.has(hash)) {
        seenFilterKeys.add(hash);
        mergedFilters.push(resolvedFilter);
      }
    }
  }

  return mergedFilters;
}

/**
 * Builds a QueryPlan for a KPI widget.
 */
function buildKpiPlan(
  tableName: SafeIdentifier,
  widget: KPIWidgetSpec,
  filters: QueryFilter[]
): QueryPlan {
  const plan: QueryPlan = {
    id: `plan_${widget.id}`.slice(0, 64) as SafeEntityId,
    table: tableName,
    aggregations: [
      {
        columnKey: widget.measure,
        function: widget.aggregation,
        alias: widget.measure,
      },
    ],
    filters: filters.length > 0 ? filters : undefined,
    limit: 1,
  };
  return QueryPlanSchema.parse(plan);
}

/**
 * Builds a QueryPlan for a Line Chart widget.
 */
function buildLinePlan(
  tableName: SafeIdentifier,
  widget: LineChartWidgetSpec,
  filters: QueryFilter[]
): QueryPlan {
  const aggregations: QueryAggregation[] = widget.measures.map((m) => ({
    columnKey: m,
    function: widget.aggregation,
    alias: m,
  }));

  const plan: QueryPlan = {
    id: `plan_${widget.id}`.slice(0, 64) as SafeEntityId,
    table: tableName,
    dimensions: [widget.timeDimension],
    aggregations,
    filters: filters.length > 0 ? filters : undefined,
    orderBy: [
      {
        columnKey: widget.timeDimension,
        direction: 'asc',
      },
    ],
  };
  return QueryPlanSchema.parse(plan);
}

/**
 * Builds a QueryPlan for a Bar Chart widget.
 */
function buildBarPlan(
  tableName: SafeIdentifier,
  widget: BarChartWidgetSpec,
  filters: QueryFilter[]
): QueryPlan {
  const aggregations: QueryAggregation[] = widget.measures.map((m) => ({
    columnKey: m,
    function: widget.aggregation,
    alias: m,
  }));

  let orderBy: QueryOrderBy[];
  if (widget.sort) {
    if (widget.sort.by === 'value') {
      orderBy = [{ columnKey: widget.measures[0]!, direction: widget.sort.direction }];
    } else {
      orderBy = [{ columnKey: widget.dimension, direction: widget.sort.direction }];
    }
  } else {
    // Default: measure descending
    orderBy = [{ columnKey: widget.measures[0]!, direction: 'desc' }];
  }

  const plan: QueryPlan = {
    id: `plan_${widget.id}`.slice(0, 64) as SafeEntityId,
    table: tableName,
    dimensions: [widget.dimension],
    aggregations,
    filters: filters.length > 0 ? filters : undefined,
    orderBy,
    limit: widget.limit ?? 20,
  };
  return QueryPlanSchema.parse(plan);
}

/**
 * Builds a QueryPlan for a Donut Chart widget.
 */
function buildDonutPlan(
  tableName: SafeIdentifier,
  widget: DonutChartWidgetSpec,
  filters: QueryFilter[]
): QueryPlan {
  const plan: QueryPlan = {
    id: `plan_${widget.id}`.slice(0, 64) as SafeEntityId,
    table: tableName,
    dimensions: [widget.dimension],
    aggregations: [
      {
        columnKey: widget.measure,
        function: widget.aggregation,
        alias: widget.measure,
      },
    ],
    filters: filters.length > 0 ? filters : undefined,
    orderBy: [
      {
        columnKey: widget.measure,
        direction: 'desc',
      },
    ],
    limit: widget.maxSlices ?? 10,
  };
  return QueryPlanSchema.parse(plan);
}

/**
 * Builds a QueryPlan for a Table widget.
 */
function buildTablePlan(
  tableName: SafeIdentifier,
  widget: TableWidgetSpec,
  filters: QueryFilter[]
): QueryPlan {
  const select = widget.columns.map((c) => c.columnKey);

  let orderBy: QueryOrderBy[] | undefined;
  if (widget.defaultSort) {
    orderBy = [
      {
        columnKey: widget.defaultSort.columnKey,
        direction: widget.defaultSort.direction,
      },
    ];
  }

  const plan: QueryPlan = {
    id: `plan_${widget.id}`.slice(0, 64) as SafeEntityId,
    table: tableName,
    select,
    filters: filters.length > 0 ? filters : undefined,
    orderBy,
    limit: widget.pageSize ?? 50,
    offset: 0,
  };
  return QueryPlanSchema.parse(plan);
}

/**
 * Builds a QueryPlan for a Pivot Table widget.
 */
function buildPivotPlan(
  tableName: SafeIdentifier,
  widget: PivotTableWidgetSpec,
  filters: QueryFilter[]
): QueryPlan {
  const dimensions: SafeIdentifier[] = [
    ...widget.rowDimensions,
    ...(widget.colDimensions ?? []),
  ];

  const seenAliases = new Set<string>();
  const aggregations: QueryAggregation[] = widget.measures.map((m) => {
    let alias = m.columnKey;
    if (seenAliases.has(alias)) {
      alias = `${m.columnKey}_${m.aggregation}` as SafeIdentifier;
    }
    seenAliases.add(alias);
    return {
      columnKey: m.columnKey,
      function: m.aggregation,
      alias: alias as SafeIdentifier,
    };
  });

  const orderBy: QueryOrderBy[] = widget.rowDimensions.map((d) => ({
    columnKey: d,
    direction: 'asc',
  }));

  const plan: QueryPlan = {
    id: `plan_${widget.id}`.slice(0, 64) as SafeEntityId,
    table: tableName,
    dimensions,
    aggregations,
    filters: filters.length > 0 ? filters : undefined,
    orderBy,
  };
  return QueryPlanSchema.parse(plan);
}

/**
 * Transforms any supported Dashboard WidgetSpec and active filter values into a validated QueryPlan.
 */
export function buildWidgetQueryPlan(
  sheet: SheetModel | SheetProfile,
  widget: WidgetSpec,
  activeFilters?: FilterValueMap | QueryFilter[]
): QueryPlan {
  const tableName = getSheetTableName(sheet);
  const mergedFilters = resolveMergedFilters(sheet, widget, activeFilters);

  switch (widget.type) {
    case 'kpi':
      return buildKpiPlan(tableName, widget, mergedFilters);
    case 'line':
      return buildLinePlan(tableName, widget, mergedFilters);
    case 'bar':
      return buildBarPlan(tableName, widget, mergedFilters);
    case 'donut':
      return buildDonutPlan(tableName, widget, mergedFilters);
    case 'table':
      return buildTablePlan(tableName, widget, mergedFilters);
    case 'pivot':
      return buildPivotPlan(tableName, widget, mergedFilters);
    default: {
      const exhaustiveCheck: never = widget;
      throw new Error(`Unsupported widget type: ${(exhaustiveCheck as { type: string }).type}`);
    }
  }
}
