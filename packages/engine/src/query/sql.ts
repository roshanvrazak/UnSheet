import type {
  AggregationFunction,
  QueryAggregation,
  QueryFilter,
  QueryPlan,
  SafeSqlQuery,
} from '@unsheet/contracts';
import {
  SafeIdentifierSchema,
  SafeSqlQuerySchema,
} from '@unsheet/contracts';

/**
 * Safely quotes an SQL identifier with double quotes, escaping any internal double quotes.
 * Asserts the identifier strictly satisfies SafeIdentifierSchema.
 */
export function quoteIdentifier(ident: string): string {
  SafeIdentifierSchema.parse(ident);
  return `"${ident.replace(/"/g, '""')}"`;
}

/**
 * Escapes JavaScript primitive values into safe SQL literal strings.
 * Strings are wrapped in single quotes with internal single quotes doubled (' -> '').
 */
export function escapeSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite number cannot be escaped into SQL literal: ${value}`);
    }
    return String(value);
  }
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (Array.isArray(value)) {
    return `(${value.map(escapeSqlLiteral).join(', ')})`;
  }
  throw new Error(`Unsupported type for SQL literal escaping: ${typeof value}`);
}

/**
 * Compiles an aggregation function and target column into safe SQL.
 */
function compileAggregation(agg: QueryAggregation): string {
  const col = quoteIdentifier(agg.columnKey);
  const func = agg.function as AggregationFunction;
  switch (func) {
    case 'sum':
      return `SUM(${col})`;
    case 'avg':
      return `AVG(${col})`;
    case 'count':
      return `COUNT(${col})`;
    case 'min':
      return `MIN(${col})`;
    case 'max':
      return `MAX(${col})`;
    case 'distinctCount':
      return `COUNT(DISTINCT ${col})`;
    default: {
      const exhaustiveCheck: never = func;
      throw new Error(`Unsupported aggregation function: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Compiles a single QueryFilter condition into safe SQL predicate.
 */
function compileFilter(filter: QueryFilter): string {
  const col = quoteIdentifier(filter.columnKey);
  const { operator, value } = filter;

  switch (operator) {
    case 'eq':
      if (value === null) {
        return `${col} IS NULL`;
      }
      return `${col} = ${escapeSqlLiteral(value)}`;

    case 'neq':
      if (value === null) {
        return `${col} IS NOT NULL`;
      }
      return `${col} != ${escapeSqlLiteral(value)}`;

    case 'gt':
      return `${col} > ${escapeSqlLiteral(value)}`;

    case 'gte':
      return `${col} >= ${escapeSqlLiteral(value)}`;

    case 'lt':
      return `${col} < ${escapeSqlLiteral(value)}`;

    case 'lte':
      return `${col} <= ${escapeSqlLiteral(value)}`;

    case 'in': {
      if (!Array.isArray(value) || value.length === 0) {
        return '1 = 0';
      }
      return `${col} IN (${value.map(escapeSqlLiteral).join(', ')})`;
    }

    case 'not_in': {
      if (!Array.isArray(value) || value.length === 0) {
        return '1 = 1';
      }
      return `${col} NOT IN (${value.map(escapeSqlLiteral).join(', ')})`;
    }

    case 'between': {
      if (!Array.isArray(value) || value.length < 2) {
        throw new Error('BETWEEN filter operator requires an array of 2 values [min, max]');
      }
      return `${col} BETWEEN ${escapeSqlLiteral(value[0])} AND ${escapeSqlLiteral(value[1])}`;
    }

    case 'contains': {
      const sanitized = String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/'/g, "''");
      return `${col} LIKE '%${sanitized}%' ESCAPE '\\'`;
    }

    case 'starts_with': {
      const sanitized = String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/'/g, "''");
      return `${col} LIKE '${sanitized}%' ESCAPE '\\'`;
    }

    case 'ends_with': {
      const sanitized = String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/'/g, "''");
      return `${col} LIKE '%${sanitized}' ESCAPE '\\'`;
    }

    case 'is_null':
      return `${col} IS NULL`;

    case 'is_not_null':
      return `${col} IS NOT NULL`;

    default: {
      const exhaustiveCheck: never = operator;
      throw new Error(`Unsupported filter operator: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Compiles a structured QueryPlan into deterministic, injection-proof SafeSqlQuery.
 */
export function compileQueryPlanToSql(plan: QueryPlan): SafeSqlQuery {
  const selectParts: string[] = [];

  if (plan.select && plan.select.length > 0) {
    selectParts.push(...plan.select.map(quoteIdentifier));
  } else {
    if (plan.dimensions && plan.dimensions.length > 0) {
      selectParts.push(...plan.dimensions.map(quoteIdentifier));
    }
    if (plan.aggregations && plan.aggregations.length > 0) {
      selectParts.push(
        ...plan.aggregations.map(
          (agg) => `${compileAggregation(agg)} AS ${quoteIdentifier(agg.alias)}`
        )
      );
    }
  }

  if (selectParts.length === 0) {
    selectParts.push('*');
  }

  const queryChunks: string[] = [];
  queryChunks.push(`SELECT ${selectParts.join(', ')}`);
  queryChunks.push(`FROM ${quoteIdentifier(plan.table)}`);

  if (plan.filters && plan.filters.length > 0) {
    const whereConditions = plan.filters.map(compileFilter).join(' AND ');
    queryChunks.push(`WHERE ${whereConditions}`);
  }

  if (plan.dimensions && plan.dimensions.length > 0) {
    queryChunks.push(`GROUP BY ${plan.dimensions.map(quoteIdentifier).join(', ')}`);
  }

  if (plan.orderBy && plan.orderBy.length > 0) {
    const orderDirectives = plan.orderBy
      .map((o) => `${quoteIdentifier(o.columnKey)} ${o.direction?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`)
      .join(', ');
    queryChunks.push(`ORDER BY ${orderDirectives}`);
  }

  if (plan.limit !== undefined) {
    queryChunks.push(`LIMIT ${plan.limit}`);
  }

  if (plan.offset !== undefined) {
    queryChunks.push(`OFFSET ${plan.offset}`);
  }

  const sql = queryChunks.join(' ');
  return SafeSqlQuerySchema.parse(sql);
}
