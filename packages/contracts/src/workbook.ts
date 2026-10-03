import { z } from 'zod';
import { SafeIdentifierSchema, IsoDateTimeSchema } from './common.js';

/**
 * Cell data types as recognized by the normalization engine.
 */
export const CellTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'null',
  'error',
]);

export type CellType = z.infer<typeof CellTypeSchema>;

/**
 * Representation of an individual parsed cell.
 */
export const CellModelSchema = z.object({
  rowIndex: z.number().int().nonnegative(),
  columnIndex: z.number().int().nonnegative(),
  raw: z.unknown(),
  formatted: z.string().optional(),
  type: CellTypeSchema,
  formula: z.string().optional(),
  origin: z.string().regex(/^[A-Z]+[0-9]+$/, 'Must be a valid A1-style cell reference').optional(),
});

export type CellModel = z.infer<typeof CellModelSchema>;

/**
 * Metadata for detected spreadsheet headers.
 */
export const HeaderMetadataSchema = z.object({
  detectedRowIndex: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  originalHeaders: z.array(z.string().max(256)),
  sanitizedKeys: z.array(SafeIdentifierSchema),
});

export type HeaderMetadata = z.infer<typeof HeaderMetadataSchema>;

/**
 * Column definition within a normalized sheet.
 */
export const ColumnMetadataSchema = z.object({
  key: SafeIdentifierSchema,
  originalName: z.string().min(1).max(256),
  columnIndex: z.number().int().nonnegative(),
});

export type ColumnMetadata = z.infer<typeof ColumnMetadataSchema>;

/**
 * Normalized 2D sheet bounds.
 */
export const SheetBoundsSchema = z.object({
  startRow: z.number().int().nonnegative(),
  endRow: z.number().int().nonnegative(),
  startCol: z.number().int().nonnegative(),
  endCol: z.number().int().nonnegative(),
});

export type SheetBounds = z.infer<typeof SheetBoundsSchema>;

/**
 * Normalized sheet structure containing clean tabular records and metadata.
 */
export const SheetModelSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  headers: HeaderMetadataSchema,
  columns: z.array(ColumnMetadataSchema).min(1, 'Sheet must contain at least one column'),
  rows: z.array(z.record(SafeIdentifierSchema, z.unknown())),
  rowCount: z.number().int().nonnegative(),
  columnCount: z.number().int().nonnegative(),
  rawBounds: SheetBoundsSchema.optional(),
});

export type SheetModel = z.infer<typeof SheetModelSchema>;

/**
 * Supported file types for ingestion.
 */
export const FileTypeSchema = z.enum(['xlsx', 'xls', 'csv', 'tsv']);
export type FileType = z.infer<typeof FileTypeSchema>;

/**
 * Workbook metadata summary.
 */
export const WorkbookMetadataSchema = z.object({
  createdAt: IsoDateTimeSchema.optional(),
  sheetCount: z.number().int().positive(),
  fileType: FileTypeSchema,
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/, 'Must be a 64-character SHA-256 hex digest').optional(),
});

export type WorkbookMetadata = z.infer<typeof WorkbookMetadataSchema>;

/**
 * Normalized workbook model representing a complete spreadsheet document.
 */
export const WorkbookModelSchema = z.object({
  id: z.string().min(1).max(64),
  filename: z.string().min(1).max(256),
  fileSize: z.number().int().positive(),
  sheets: z.array(SheetModelSchema).min(1, 'Workbook must contain at least one sheet').max(50, 'Workbook exceeds maximum 50 sheets'),
  activeSheetIndex: z.number().int().nonnegative(),
  metadata: WorkbookMetadataSchema.optional(),
});

export type WorkbookModel = z.infer<typeof WorkbookModelSchema>;
