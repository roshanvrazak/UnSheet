const SUBTOTAL_PATTERN =
  /^\s*(?:total|subtotal|sub-total|grand\s*total|sum|average|avg)\b/i;

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
 */
export function isSubtotalRow(row: unknown[] | undefined): boolean {
  if (!row || row.length === 0) return false;

  for (const cell of row) {
    if (cell === null || cell === undefined) continue;
    const str = String(cell).trim();
    if (str === '') continue;

    if (SUBTOTAL_PATTERN.test(str)) {
      return true;
    }
    // If the first non-empty text cell is not a subtotal marker, this is not a subtotal row
    break;
  }

  return false;
}

/**
 * Checks if a row is a footnote, comment, or attribution line.
 */
export function isFootnoteRow(row: unknown[] | undefined, totalColumns: number): boolean {
  if (!row || row.length === 0) return false;

  const filledCells = row.filter((c) => {
    if (c === null || c === undefined) return false;
    if (typeof c === 'string' && c.trim() === '') return false;
    return true;
  });

  if (filledCells.length === 0) return false;

  // Footnotes typically span 1 or at most 2 cells in multi-column tables
  const fillRatio = filledCells.length / Math.max(totalColumns, 1);
  if (fillRatio > 0.4 && totalColumns > 2) {
    return false;
  }

  const firstText = String(filledCells[0]).trim();
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
