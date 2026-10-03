import { z } from 'zod';
import { FORBIDDEN_OBJECT_KEYS } from './common.js';

/**
 * Supported file formats for exporting dashboard data.
 */
export const ExportFormatSchema = z.enum(['csv', 'xlsx', 'json', 'tsv']);

export type ExportFormat = z.infer<typeof ExportFormatSchema>;

/**
 * Formula trigger characters that can trigger CSV/formula injection in spreadsheet applications.
 * Includes =, +, -, @, \t, \r, \n, and pipe | (even when preceded by leading whitespace).
 */
export const FORMULA_TRIGGER_REGEX = /^[=+\-@\t\r\n|]/;

/**
 * Neutralizes a cell string value against spreadsheet formula injection (CSV injection).
 * If the string begins with a formula trigger character (after trimming leading whitespace),
 * it is prepended with a single quote (') to force literal interpretation in Excel and Calc.
 */
export function neutralizeFormula(val: string): string {
  if (FORMULA_TRIGGER_REGEX.test(val.trimStart())) {
    return `'${val}`;
  }
  return val;
}

/**
 * Safe cell schema for export generation.
 * String cells have formula-neutralization rules applied automatically.
 * Numbers must be finite (rejecting Infinity and NaN).
 */
export const SafeExportCellSchema = z.union([
  z.string().transform((val) => neutralizeFormula(val)),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export type SafeExportCell = z.infer<typeof SafeExportCellSchema>;

/**
 * Export column key: allows human-readable column headers (with spaces/symbols),
 * but strictly rejects prototype pollution property names (__proto__, constructor, prototype).
 */
export const ExportColumnKeySchema = z
  .string()
  .min(1, 'Column header must not be empty')
  .max(256, 'Column header exceeds maximum length of 256 characters')
  .refine(
    (key) => !FORBIDDEN_OBJECT_KEYS.includes(key as typeof FORBIDDEN_OBJECT_KEYS[number]),
    { message: 'Column header cannot match prototype properties (__proto__, constructor, prototype)' }
  );

export type ExportColumnKey = z.infer<typeof ExportColumnKeySchema>;

/**
 * Schema for an exported row: either an object mapping safe column keys to safe cells,
 * or a flat array of safe cells.
 */
export const ExportRowSchema = z.union([
  z.record(ExportColumnKeySchema, SafeExportCellSchema),
  z.array(SafeExportCellSchema),
]);

export type ExportRow = z.infer<typeof ExportRowSchema>;

/**
 * Options controlling export generation.
 */
export const ExportOptionsSchema = z.object({
  format: ExportFormatSchema,
  sheetName: z.string().min(1).max(128),
  sanitizeFormulaInjection: z.boolean().default(true),
  includeHeaders: z.boolean().default(true),
});

export type ExportOptions = z.infer<typeof ExportOptionsSchema>;

/**
 * Schema for a tabular dataset prepared for safe file export.
 */
export const ExportTableSchema = z.object({
  sheetName: z.string().min(1).max(128),
  headers: z.array(z.string().max(256)),
  rows: z.array(ExportRowSchema),
  rowCount: z.number().int().nonnegative().optional(),
});

export type ExportTable = z.infer<typeof ExportTableSchema>;
