import * as XLSX from 'xlsx';
import { ExportTableSchema, type ExportTable, type ExportOptions, neutralizeFormula } from '@unsheet/contracts';

/**
 * Exports an ExportTable to an XLSX Uint8Array buffer using SheetJS,
 * ensuring all string cells starting with formula triggers are forced to string literal type ('s').
 */
export function exportToXlsx(table: ExportTable, options?: Partial<ExportOptions>): Uint8Array {
  const validated = ExportTableSchema.parse(table);
  const includeHeaders = options?.includeHeaders ?? true;
  const sanitize = options?.sanitizeFormulaInjection ?? true;

  const aoa: unknown[][] = [];

  const formatCell = (val: unknown): unknown => {
    if (val === null || val === undefined) {
      return '';
    }
    if (typeof val === 'string' && sanitize) {
      return neutralizeFormula(val);
    }
    return val;
  };

  if (includeHeaders && validated.headers.length > 0) {
    aoa.push(validated.headers.map((h) => formatCell(h)));
  }

  for (const row of validated.rows) {
    if (Array.isArray(row)) {
      aoa.push(row.map((cell) => formatCell(cell)));
    } else {
      const keys = validated.headers.length > 0 ? validated.headers : Object.keys(row).sort();
      const recordRow = keys.map((key) => formatCell((row as Record<string, unknown>)[key]));
      aoa.push(recordRow);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Explicitly ensure string cells starting with formula triggers are type 's' (string literal)
  for (const cellAddress of Object.keys(ws)) {
    if (cellAddress.startsWith('!')) continue;
    const cell = ws[cellAddress];
    if (cell && cell.t === 's' && typeof cell.v === 'string') {
      if (sanitize) {
        cell.v = neutralizeFormula(cell.v);
      }
    }
  }

  const wb = XLSX.utils.book_new();
  const sheetName = options?.sheetName || validated.sheetName || 'Sheet1';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buf);
}
