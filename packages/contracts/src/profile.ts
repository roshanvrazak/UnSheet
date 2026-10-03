import { z } from 'zod';
import { SafeIdentifierSchema, SampleValuesArraySchema } from './common.js';

/**
 * Inferred data types for spreadsheet columns.
 */
export const InferredDataTypeSchema = z.enum([
  'number',
  'currency',
  'percent',
  'date',
  'category',
  'id',
  'boolean',
  'text',
]);

export type InferredDataType = z.infer<typeof InferredDataTypeSchema>;

/**
 * Semantic role of a column in visualization heuristics and query generation.
 */
export const SemanticRoleSchema = z.enum([
  'dimension',
  'measure',
  'time',
  'identifier',
]);

export type SemanticRole = z.infer<typeof SemanticRoleSchema>;

/**
 * Summary statistics for numeric and quantifiable columns.
 */
export const NumericStatsSchema = z.object({
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  mean: z.number().nullable().optional(),
  median: z.number().nullable().optional(),
  sum: z.number().nullable().optional(),
  variance: z.number().nullable().optional(),
  stdDev: z.number().nullable().optional(),
});

export type NumericStats = z.infer<typeof NumericStatsSchema>;

/**
 * Frequency breakdown for categorical columns.
 */
export const CategoryFrequencySchema = z.object({
  value: z.string().max(256),
  count: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
});

export type CategoryFrequency = z.infer<typeof CategoryFrequencySchema>;

/**
 * Detailed column profile combining statistical metrics, inferred types, and capped sample values.
 * Invariant: sampleValues is capped at max 5 items with <=40 characters each to prevent LLM data exfiltration.
 */
export const ColumnProfileSchema = z.object({
  columnKey: SafeIdentifierSchema,
  originalName: z.string().min(1).max(256),
  inferredType: InferredDataTypeSchema,
  semanticRole: SemanticRoleSchema,
  nullable: z.boolean(),
  nullCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  distinctCount: z.number().int().nonnegative(),
  uniquenessRatio: z.number().min(0).max(1),
  stats: NumericStatsSchema.optional(),
  topValues: z.array(CategoryFrequencySchema).max(50).optional(),
  sampleValues: SampleValuesArraySchema,
  currencyCode: z.string().regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO currency code').optional(),
  formatPattern: z.string().max(64).optional(),
});

export type ColumnProfile = z.infer<typeof ColumnProfileSchema>;

/**
 * Sheet-level profile with aggregated column profiles and heuristic suggestions.
 */
export const SheetProfileSchema = z.object({
  sheetId: z.string().min(1).max(64),
  sheetName: z.string().min(1).max(128),
  rowCount: z.number().int().nonnegative(),
  columnProfiles: z.array(ColumnProfileSchema).min(1, 'Sheet profile must have at least one column profile'),
  primaryKeyCandidate: SafeIdentifierSchema.optional(),
  recommendedDimensions: z.array(SafeIdentifierSchema),
  recommendedMeasures: z.array(SafeIdentifierSchema),
  recommendedTimeColumn: SafeIdentifierSchema.optional(),
});

export type SheetProfile = z.infer<typeof SheetProfileSchema>;
