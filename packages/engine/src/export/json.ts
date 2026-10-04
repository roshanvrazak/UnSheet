import { ExportTableSchema, type ExportTable, neutralizeFormula } from '@unsheet/contracts';

/**
 * Exports an ExportTable to a formatted JSON string with formula neutralization on string cells.
 */
export function exportToJson(table: ExportTable): string {
  const validated = ExportTableSchema.parse(table);

  const sanitizeCell = (val: unknown): unknown => {
    if (typeof val === 'string') {
      return neutralizeFormula(val);
    }
    return val;
  };

  const sanitizedRows = validated.rows.map((row) => {
    if (Array.isArray(row)) {
      return row.map((cell) => sanitizeCell(cell));
    } else {
      const sanitizedRecord: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        sanitizedRecord[k] = sanitizeCell(v);
      }
      return sanitizedRecord;
    }
  });

  return JSON.stringify(sanitizedRows, null, 2);
}
