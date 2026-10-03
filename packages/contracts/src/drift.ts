import { z } from 'zod';
import { SafeIdentifierSchema, SampleValuesArraySchema } from './common.js';
import { InferredDataTypeSchema } from './profile.js';

/**
 * Status of an individual expected column during drift analysis.
 */
export const ColumnDriftStatusSchema = z.enum([
  'matched',
  'missing',
  'type_changed',
  'renamed',
]);

export type ColumnDriftStatus = z.infer<typeof ColumnDriftStatusSchema>;

/**
 * Detailed drift status for a single expected column.
 */
export const ColumnDriftSchema = z.object({
  expectedKey: SafeIdentifierSchema,
  expectedType: InferredDataTypeSchema,
  status: ColumnDriftStatusSchema,
  foundKey: SafeIdentifierSchema.optional(),
  foundType: InferredDataTypeSchema.optional(),
  confidence: z.number().min(0).max(1),
  sampleValues: SampleValuesArraySchema.optional(),
});

export type ColumnDrift = z.infer<typeof ColumnDriftSchema>;

/**
 * Newly introduced column discovered in the uploaded sheet not in template.
 */
export const AddedColumnSchema = z.object({
  columnKey: SafeIdentifierSchema,
  originalName: z.string().min(1).max(256),
  inferredType: InferredDataTypeSchema,
  sampleValues: SampleValuesArraySchema.optional(),
});

export type AddedColumn = z.infer<typeof AddedColumnSchema>;

/**
 * Discrepancy where column exists by name but data type changed.
 */
export const TypeMismatchSchema = z.object({
  columnKey: SafeIdentifierSchema,
  expectedType: InferredDataTypeSchema,
  actualType: InferredDataTypeSchema,
  isCoercible: z.boolean(),
});

export type TypeMismatch = z.infer<typeof TypeMismatchSchema>;

/**
 * Algorithmic recommendation for mapping a missing column to an added column.
 */
export const RemappingSuggestionSchema = z.object({
  missingKey: SafeIdentifierSchema,
  suggestedKey: SafeIdentifierSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(256).optional(),
});

export type RemappingSuggestion = z.infer<typeof RemappingSuggestionSchema>;

/**
 * Comprehensive schema drift report comparing a template's expected schema with a new dataset.
 */
export const DriftReportSchema = z.object({
  templateId: z.string().min(1).max(64),
  sourceSheetName: z.string().min(1).max(128),
  overallConfidence: z.number().min(0).max(1),
  hasBreakingChanges: z.boolean(),
  matchedColumns: z.array(z.object({
    expectedKey: SafeIdentifierSchema,
    actualKey: SafeIdentifierSchema,
    confidence: z.number().min(0).max(1),
  })),
  missingColumns: z.array(SafeIdentifierSchema),
  addedColumns: z.array(AddedColumnSchema),
  typeMismatches: z.array(TypeMismatchSchema),
  suggestedRemappings: z.array(RemappingSuggestionSchema),
});

export type DriftReport = z.infer<typeof DriftReportSchema>;
