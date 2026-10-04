import { ExportTableSchema, type ExportTable, type ExportOptions, neutralizeFormula } from '@unsheet/contracts';

/**
 * Exports an ExportTable to RFC 4180 compliant CSV string with formula neutralization.
 */
export function exportToCsv(table: ExportTable, options?: Partial<ExportOptions>): string {
  const validated = ExportTableSchema.parse(table);
  const includeHeaders = options?.includeHeaders ?? true;
  const sanitize = options?.sanitizeFormulaInjection ?? true;

  const rows: string[][] = [];

  const formatCell = (val: unknown): string => {
    if (val === null || val === undefined) {
      return '';
    }
    let str = String(val);
    if (sanitize) {
      str = neutralizeFormula(str);
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  if (includeHeaders && validated.headers.length > 0) {
    const headerRow = validated.headers.map((h) => formatCell(h));
    rows.push(headerRow);
  }

  for (const row of validated.rows) {
    if (Array.isArray(row)) {
      rows.push(row.map((cell) => formatCell(cell)));
    } else {
      const keys = validated.headers.length > 0 ? validated.headers : Object.keys(row).sort();
      const recordRow = keys.map((key) => formatCell((row as Record<string, unknown>)[key]));
      rows.push(recordRow);
    }
  }

  return rows.map((r) => r.join(',')).join('\r\n');
}
