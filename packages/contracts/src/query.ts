import { z } from 'zod';
import { SafeIdentifierSchema } from './common.js';
import { AggregationFunctionSchema } from './spec.js';

/**
 * Supported comparison and logical operators for in-browser SQL filtering.
 */
export const QueryFilterOperatorSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'not_in',
  'between',
  'contains',
  'starts_with',
  'ends_with',
  'is_null',
  'is_not_null',
]);

export type QueryFilterOperator = z.infer<typeof QueryFilterOperatorSchema>;

/**
 * Filter condition within a query plan.
 */
export const QueryFilterSchema = z.object({
  columnKey: SafeIdentifierSchema,
  operator: QueryFilterOperatorSchema,
  value: z.unknown().optional(),
});

export type QueryFilter = z.infer<typeof QueryFilterSchema>;

/**
 * Sort order directive.
 */
export const QueryOrderBySchema = z.object({
  columnKey: SafeIdentifierSchema,
  direction: z.enum(['asc', 'desc']).default('asc'),
});

export type QueryOrderBy = z.infer<typeof QueryOrderBySchema>;

/**
 * Aggregation specification within a structured query.
 */
export const QueryAggregationSchema = z.object({
  columnKey: SafeIdentifierSchema,
  function: AggregationFunctionSchema,
  alias: SafeIdentifierSchema,
});

export type QueryAggregation = z.infer<typeof QueryAggregationSchema>;

/**
 * Structured Query Plan executed safely against in-memory DuckDB-WASM tables.
 */
export const QueryPlanSchema = z.object({
  id: z.string().min(1).max(64),
  table: SafeIdentifierSchema,
  dimensions: z.array(SafeIdentifierSchema).optional(),
  aggregations: z.array(QueryAggregationSchema).optional(),
  select: z.array(SafeIdentifierSchema).optional(),
  filters: z.array(QueryFilterSchema).optional(),
  orderBy: z.array(QueryOrderBySchema).optional(),
  limit: z.number().int().positive().max(50000).optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type QueryPlan = z.infer<typeof QueryPlanSchema>;

/**
 * Schema for returned column metadata in query results.
 */
export const QueryResultColumnSchema = z.object({
  name: SafeIdentifierSchema,
  type: z.string().min(1).max(64),
});

export type QueryResultColumn = z.infer<typeof QueryResultColumnSchema>;

/**
 * Query execution result payload.
 */
export const QueryResultSchema = z.object({
  queryId: z.string().min(1).max(64),
  columns: z.array(QueryResultColumnSchema),
  rows: z.array(z.record(SafeIdentifierSchema, z.unknown())),
  rowCount: z.number().int().nonnegative(),
  executionTimeMs: z.number().nonnegative(),
  cached: z.boolean().optional(),
});

export type QueryResult = z.infer<typeof QueryResultSchema>;
