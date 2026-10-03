import { z } from 'zod';
import { SafeIdentifierSchema, SafeEntityIdSchema } from './common.js';
import { AggregationFunctionSchema } from './spec.js';

const FORBIDDEN_SQL_KEYWORD_REGEX =
  /\b(DROP|INSERT|UPDATE|DELETE|ALTER|CREATE|COPY|ATTACH|DETACH|INSTALL|LOAD|PRAGMA)\b/i;

const FORBIDDEN_SQL_FUNCTION_REGEX =
  /\b(read_csv|read_csv_auto|read_parquet|read_json|read_json_auto|scan_parquet|parquet_scan|write_csv|to_csv|write_parquet|to_parquet|read_blob|read_text)\s*\(/i;


/**
 * Validates that an ad-hoc SQL query is a single, safe SELECT or WITH statement.
 * Strictly forbids DDL/DML, multi-statement queries, ATTACH/INSTALL/LOAD/PRAGMA,
 * and dangerous DuckDB file functions.
 */
export const SafeSqlQuerySchema = z
  .string()
  .min(1, 'SQL query cannot be empty')
  .max(4000, 'SQL query exceeds maximum 4000 characters')
  .refine(
    (sql) => /^(SELECT|WITH)\b/i.test(sql.trim()),
    { message: 'Query must start with SELECT or WITH' }
  )
  .refine(
    (sql) => !/;[\s\S]*\S/.test(sql.trim()),
    { message: 'Multi-statement SQL queries are strictly prohibited' }
  )
  .refine(
    (sql) => !FORBIDDEN_SQL_KEYWORD_REGEX.test(sql),
    { message: 'DDL, DML, administrative, and external database operations are strictly prohibited' }
  )
  .refine(
    (sql) => !FORBIDDEN_SQL_FUNCTION_REGEX.test(sql),
    { message: 'Dangerous file-access and external functions are strictly prohibited' }
  );

export type SafeSqlQuery = z.infer<typeof SafeSqlQuerySchema>;

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
 * Constrained primitive filter value types to prevent passing complex objects or prototype keys.
 */
export const QueryFilterValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number().finite()])),
]);

export type QueryFilterValue = z.infer<typeof QueryFilterValueSchema>;

/**
 * Filter condition within a query plan.
 */
export const QueryFilterSchema = z.object({
  columnKey: SafeIdentifierSchema,
  operator: QueryFilterOperatorSchema,
  value: QueryFilterValueSchema.optional(),
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
  id: SafeEntityIdSchema,
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
  queryId: SafeEntityIdSchema,
  columns: z.array(QueryResultColumnSchema),
  rows: z.array(z.record(SafeIdentifierSchema, z.unknown())),
  rowCount: z.number().int().nonnegative(),
  executionTimeMs: z.number().finite().nonnegative(),
  cached: z.boolean().optional(),
});

export type QueryResult = z.infer<typeof QueryResultSchema>;
