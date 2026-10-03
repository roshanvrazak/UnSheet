import * as XLSX from 'xlsx';
import {
  MAX_SHEETS,
  MAX_ROWS,
  MAX_COLUMNS,
  FORBIDDEN_OBJECT_KEYS,
  type FileType,
  type SheetBounds,
} from '@unsheet/contracts';
import { SheetBoundsError, CorruptedFileError } from './errors.js';

export interface SheetMergeRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface RawSheet {
  name: string;
  grid: unknown[][];
  merges: SheetMergeRange[];
  rawBounds?: SheetBounds | undefined;
}

export interface RawWorkbook {
  filename: string;
  fileSize: number;
  fileType: FileType;
  sourceHash?: string | undefined;
  sheets: RawSheet[];
}

/**
 * Parses a spreadsheet file into raw grid representations using SheetJS.
 * Pure TypeScript execution without DOM access.
 * Reads cached values only (cell.v) and strictly enforces sheet, row, and column limits.
 */
export function parseSheetJs(
  buffer: Uint8Array,
  filename: string,
  fileType: FileType,
  sourceHash?: string
): RawWorkbook {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellText: false,
      WTF: false,
      doctype: false,
      nodeProcess: false,
      bookVBA: false,
    } as XLSX.ParsingOptions);
  } catch (err: unknown) {
    throw new CorruptedFileError(
      `Failed to parse spreadsheet file: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new SheetBoundsError('Workbook must contain at least one sheet');
  }

  if (workbook.SheetNames.length > MAX_SHEETS) {
    throw new SheetBoundsError(
      `Workbook contains ${workbook.SheetNames.length} sheets, exceeding maximum limit of ${MAX_SHEETS}`
    );
  }

  const sheets: RawSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    // SEC-P1-10 / ADV-P1-06: Guard against prototype property lookup on workbook.Sheets
    const ws =
      Object.prototype.hasOwnProperty.call(workbook.Sheets, sheetName)
        ? (workbook.Sheets[sheetName] as XLSX.WorkSheet | undefined)
        : undefined;

    // SEC-P1-10: Sanitize sheet name against prototype pollution keys
    const isForbidden = (FORBIDDEN_OBJECT_KEYS as readonly string[]).includes(sheetName);
    const safeSheetName = isForbidden ? `safe_${sheetName}` : sheetName;

    if (!ws) {
      sheets.push({
        name: safeSheetName,
        grid: [],
        merges: [],
      });
      continue;
    }

    let rawBounds: SheetBounds | undefined;
    let grid: unknown[][] = [];
    const merges: SheetMergeRange[] = [];

    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      const rowCount = Math.max(0, range.e.r - range.s.r + 1);
      const colCount = Math.max(0, range.e.c - range.s.c + 1);

      if (rowCount > MAX_ROWS) {
        throw new SheetBoundsError(
          `Sheet "${sheetName}" row count (${rowCount}) exceeds maximum limit of ${MAX_ROWS}`
        );
      }

      if (colCount > MAX_COLUMNS) {
        throw new SheetBoundsError(
          `Sheet "${sheetName}" column count (${colCount}) exceeds maximum limit of ${MAX_COLUMNS}`
        );
      }

      rawBounds = {
        startRow: Math.max(0, range.s.r),
        endRow: Math.max(0, range.e.r),
        startCol: Math.max(0, range.s.c),
        endCol: Math.max(0, range.e.c),
      };

      // Extract cells row by row
      grid = new Array<unknown[]>(rowCount);
      for (let r = 0; r < rowCount; r++) {
        const row = new Array<unknown>(colCount);
        const sheetRowIdx = range.s.r + r;
        for (let c = 0; c < colCount; c++) {
          const sheetColIdx = range.s.c + c;
          const cellAddr = XLSX.utils.encode_cell({ r: sheetRowIdx, c: sheetColIdx });
          const cell = ws[cellAddr];
          // Strictly read cached value (cell.v) only, never evaluate cell.f
          if (cell !== undefined && cell.v !== undefined) {
            row[c] = cell.v;
          } else {
            row[c] = null;
          }
        }
        grid[r] = row;
      }

      // Extract merges and offset them relative to the 0-indexed grid
      if (Array.isArray(ws['!merges'])) {
        for (const m of ws['!merges']) {
          merges.push({
            startRow: Math.max(0, m.s.r - range.s.r),
            startCol: Math.max(0, m.s.c - range.s.c),
            endRow: Math.max(0, m.e.r - range.s.r),
            endCol: Math.max(0, m.e.c - range.s.c),
          });
        }
      }
    }

    sheets.push({
      name: safeSheetName,
      grid,
      merges,
      rawBounds,
    });
  }

  return {
    filename,
    fileSize: buffer.byteLength,
    fileType,
    sourceHash,
    sheets,
  };
}
