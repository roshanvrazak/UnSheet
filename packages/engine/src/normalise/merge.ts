import type { SheetMergeRange } from '../parse/sheetjs.js';

/**
 * Forward-fills top-left cell values across merged cell ranges.
 * Optimised to shallow-clone only rows affected by merge operations.
 */
export function applyMergeForwardFill(
  grid: unknown[][],
  merges: SheetMergeRange[]
): unknown[][] {
  if (!merges || merges.length === 0 || grid.length === 0) {
    return grid;
  }

  // Determine the bounding row range across all merges
  let minRow = grid.length;
  let maxRow = -1;
  for (const merge of merges) {
    if (merge.startRow < grid.length) {
      minRow = Math.min(minRow, merge.startRow);
      maxRow = Math.max(maxRow, Math.min(merge.endRow, grid.length - 1));
    }
  }

  if (maxRow < minRow) {
    return grid;
  }

  // REV-P1-09: Clone only rows within affected merge bounds
  const result: unknown[][] = new Array(grid.length);
  for (let r = 0; r < grid.length; r++) {
    if (r >= minRow && r <= maxRow) {
      const row = grid[r];
      result[r] = row ? [...row] : [];
    } else {
      result[r] = grid[r] ?? [];
    }
  }

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
