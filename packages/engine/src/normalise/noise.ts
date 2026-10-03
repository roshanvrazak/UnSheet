import { safeToString } from './cell.js';

const SUBTOTAL_PATTERN =
  /(?:^|\s)(?:total|subtotal|sub-total|grand\s*total|sum|average|avg)\b/i;

const FOOTNOTE_PATTERN =
  /^\s*(?:\*|note[s]?:|source:|confidential|copyright|unaudited|disclaimer:)/i;

/**
 * Checks if a row is completely empty or contains only whitespace/null/undefined cells.
 */
export function isEmptySpacerRow(row: unknown[] | undefined): boolean {
  if (!row || row.length === 0) return true;
  return row.every((val) => {
    if (val === null || val === undefined) return true;
    if (typeof val === 'string' && val.trim() === '') return true;
    return false;
  });
}

/**
 * Checks if a row represents a subtotal, total, sum, or average aggregation line.
 * Scans across all cells in the row to catch category-prefixed subtotals (e.g. "Engineering Subtotal").
 */
export function isSubtotalRow(row: unknown[] | undefined): boolean {
  if (!row || row.length === 0) return false;

  for (const cell of row) {
    if (cell === null || cell === undefined) continue;
    const str = safeToString(cell).trim();
    if (str === '') continue;

    // Check if cell contains a subtotal marker (limit to < 60 chars to avoid matching paragraphs)
    if (str.length < 60 && SUBTOTAL_PATTERN.test(str)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a row is a footnote, comment, or attribution line.
 * For narrow tables (1-2 columns), requires an explicit footnote indicator pattern.
 */
export function isFootnoteRow(row: unknown[] | undefined, totalColumns: number): boolean {
  if (!row || row.length === 0) return false;

  const filledCells = row.filter((c) => {
    if (c === null || c === undefined) return false;
    const str = safeToString(c).trim();
    return str !== '';
  });

  if (filledCells.length === 0) return false;

  const firstText = safeToString(filledCells[0]).trim();

  // REV-P1-10: In narrow tables (1-2 columns), only flag if matching explicit footnote markers
  if (totalColumns <= 2) {
    return FOOTNOTE_PATTERN.test(firstText);
  }

  // Footnotes typically span 1 or at most 2 cells in multi-column tables
  const fillRatio = filledCells.length / Math.max(totalColumns, 1);
  if (fillRatio > 0.4) {
    return false;
  }

  if (FOOTNOTE_PATTERN.test(firstText)) {
    return true;
  }

  // Single cell long descriptive footnote (> 30 characters) at low fill ratio
  if (filledCells.length === 1 && typeof filledCells[0] === 'string' && firstText.length > 30) {
    return true;
  }

  return false;
}

/**
 * Strips empty spacer rows, subtotal rows, and trailing footnotes from data rows.
 * Guarantees that row count never increases.
 */
export function removeNoiseRows(
  rows: unknown[][],
  totalColumns: number
): unknown[][] {
  if (!rows || rows.length === 0) return [];

  // 1. Strip trailing empty rows and footnotes from bottom to top
  let lastValidIndex = rows.length - 1;
  while (lastValidIndex >= 0) {
    const row = rows[lastValidIndex];
    if (isEmptySpacerRow(row) || isFootnoteRow(row, totalColumns)) {
      lastValidIndex--;
    } else {
      break;
    }
  }

  const bottomTrimmed = rows.slice(0, lastValidIndex + 1);

  // 2. Filter out intermediate empty spacer rows and subtotal rows
  return bottomTrimmed.filter((row) => !isEmptySpacerRow(row) && !isSubtotalRow(row));
}
