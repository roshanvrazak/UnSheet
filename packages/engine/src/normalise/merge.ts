import type { SheetMergeRange } from '../parse/sheetjs.js';

/**
 * Forward-fills top-left cell values across merged cell ranges.
 * Essential for multi-tier category headers and merged data blocks.
 */
export function applyMergeForwardFill(
  grid: unknown[][],
  merges: SheetMergeRange[]
): unknown[][] {
  if (!merges || merges.length === 0 || grid.length === 0) {
    return grid;
  }

  // Create shallow clones of rows to avoid mutating inputs
  const result: unknown[][] = grid.map((row) => [...row]);

  for (const merge of merges) {
    const { startRow, startCol, endRow, endCol } = merge;
    if (startRow >= result.length) {
      continue;
    }

    const sourceRow = result[startRow];
    if (!sourceRow || startCol >= sourceRow.length) {
      continue;
    }

    const topLeftValue = sourceRow[startCol];

    const maxR = Math.min(endRow, result.length - 1);
    for (let r = startRow; r <= maxR; r++) {
      const targetRow = result[r];
      if (!targetRow) continue;
      const maxC = Math.min(endCol, targetRow.length - 1);
      for (let c = startCol; c <= maxC; c++) {
        targetRow[c] = topLeftValue;
      }
    }
  }

  return result;
}
