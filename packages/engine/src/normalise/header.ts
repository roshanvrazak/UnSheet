import type { SafeIdentifier } from '@unsheet/contracts';
import { isEmptySpacerRow, isSubtotalRow } from './noise.js';
import { sanitiseHeaders } from './sanitise.js';
import { safeToString } from './cell.js';

export interface HeaderDetectionResult {
  detectedRowIndex: number;
  confidence: number;
  originalHeaders: string[];
  sanitizedKeys: SafeIdentifier[];
  activeColumnIndices?: number[];
}

/**
 * Automatically detects the true header row within a 2D spreadsheet grid.
 * Evaluates candidate rows up to row 20 using string density, fill ratio,
 * distinctness, and type transitions into subsequent data rows.
 * Consolidates multi-tier merged headers and prunes empty spacer columns.
 */
export function detectHeaderRow(grid: unknown[][]): HeaderDetectionResult {
  if (!grid || grid.length === 0) {
    return {
      detectedRowIndex: 0,
      confidence: 0,
      originalHeaders: ['Column 1'],
      sanitizedKeys: sanitiseHeaders(['Column 1']),
      activeColumnIndices: [0],
    };
  }

  // Calculate the maximum column width across candidate header rows (rows 0..26)
  const candidateScanLimit = Math.min(26, grid.length);
  let maxCols = 0;
  for (let r = 0; r < candidateScanLimit; r++) {
    const row = grid[r];
    if (row && row.length > maxCols) {
      maxCols = row.length;
    }
  }

  if (maxCols === 0) {
    return {
      detectedRowIndex: 0,
      confidence: 0,
      originalHeaders: ['Column 1'],
      sanitizedKeys: sanitiseHeaders(['Column 1']),
      activeColumnIndices: [0],
    };
  }

  const maxCandidateRow = Math.min(20, grid.length - 1);
  let bestRowIndex = 0;
  let bestScore = -1;

  for (let r = 0; r <= maxCandidateRow; r++) {
    const row = grid[r];
    if (!row || isEmptySpacerRow(row) || isSubtotalRow(row)) {
      continue;
    }

    let filledCount = 0;
    let stringCount = 0;
    const seenValues = new Set<string>();

    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val === null || val === undefined) continue;
      const str = safeToString(val).trim();
      if (str === '') continue;

      filledCount++;
      seenValues.add(str);

      // Check if it is a text string (not a pure number or date)
      if (typeof val === 'string' && Number.isNaN(Number(str))) {
        stringCount++;
      }
    }

    // Rows with zero string cells cannot be header rows
    let rawStringCount = 0;
    for (let c = 0; c < row.length; c++) {
      const cellVal = row[c];
      if (typeof cellVal === 'string' && safeToString(cellVal).trim() !== '') {
        rawStringCount++;
      }
    }
    if (rawStringCount === 0 || filledCount === 0) {
      continue;
    }

    const fillRatio = filledCount / maxCols;
    const stringRatio = stringCount / filledCount;
    const distinctRatio = seenValues.size / filledCount;

    // Single-cell title banner penalty (e.g. "Annual Report" in A1, rest blank)
    let bannerPenalty = 0;
    if (filledCount === 1 && maxCols > 1) {
      bannerPenalty = 0.75;
    } else if (filledCount === 2 && maxCols >= 4) {
      bannerPenalty = 0.4;
    }

    // Inspect subsequent rows for type transition (data rows with numbers/dates)
    let transitionBoost = 0;
    const subsequentEnd = Math.min(r + 6, grid.length);
    let subsequentDataCells = 0;
    let subsequentFilledCells = 0;

    for (let subR = r + 1; subR < subsequentEnd; subR++) {
      const subRow = grid[subR];
      if (!subRow || isEmptySpacerRow(subRow)) continue;

      for (let c = 0; c < subRow.length; c++) {
        const val = subRow[c];
        if (val === null || val === undefined) continue;
        const str = safeToString(val).trim();
        if (str === '') continue;

        subsequentFilledCells++;
        if (
          typeof val === 'number' ||
          typeof val === 'boolean' ||
          val instanceof Date ||
          !Number.isNaN(Number(str))
        ) {
          subsequentDataCells++;
        }
      }
    }

    if (subsequentFilledCells > 0) {
      const dataDensity = subsequentDataCells / subsequentFilledCells;
      if (stringRatio >= 0.5 && dataDensity >= 0.25) {
        transitionBoost = 0.3 * dataDensity;
      }
    }

    // Position decay: earlier rows are strongly preferred for headers unless penalized
    const distanceDecay = Math.max(0.1, 1 - r * 0.05);

    const rawScore =
      stringRatio * 0.45 +
      fillRatio * 0.25 +
      distinctRatio * 0.15 +
      transitionBoost * 0.15 -
      bannerPenalty;

    const finalScore = Math.max(0, rawScore) * distanceDecay;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestRowIndex = r;
    }
  }

  // If no candidate was scored above 0, default to row 0 with low confidence
  if (bestScore <= 0) {
    bestRowIndex = 0;
    bestScore = 0.1;
  }

  const confidence = Math.min(1, Math.max(0, Math.round(bestScore * 100) / 100));

  // REV-P1-05: Check if preceding row contains parent category labels for multi-row merged headers
  let isMultiRowHeader = false;
  let parentRow: unknown[] | undefined;
  if (bestRowIndex > 0) {
    const candidateParent = grid[bestRowIndex - 1];
    if (candidateParent && !isEmptySpacerRow(candidateParent) && !isSubtotalRow(candidateParent)) {
      let parentFilledCount = 0;
      let parentStringCount = 0;
      for (let c = 0; c < candidateParent.length; c++) {
        const str = safeToString(candidateParent[c]).trim();
        if (str !== '') {
          parentFilledCount++;
          if (Number.isNaN(Number(str))) {
            parentStringCount++;
          }
        }
      }
      if (parentFilledCount >= 2 && parentStringCount >= 2) {
        isMultiRowHeader = true;
        parentRow = candidateParent;
      }
    }
  }

  const headerRow = grid[bestRowIndex] ?? [];
  const activeColumnIndices: number[] = [];
  const originalHeaders: string[] = [];

  // REV-P1-04: Inspect columns to detect and prune empty spacer columns
  for (let c = 0; c < maxCols; c++) {
    const childRaw = safeToString(headerRow[c]).trim();
    const parentRaw = isMultiRowHeader && parentRow ? safeToString(parentRow[c]).trim() : '';
    const hasHeader = childRaw !== '' || parentRaw !== '';

    // Check if column has any non-empty cell in subsequent data rows
    let hasData = false;
    for (let r = bestRowIndex + 1; r < grid.length; r++) {
      const dataCell = safeToString(grid[r]?.[c]).trim();
      if (dataCell !== '') {
        hasData = true;
        break;
      }
    }

    // Prune spacer column if header is empty AND all data rows in this column are empty
    if (!hasHeader && !hasData) {
      continue;
    }

    activeColumnIndices.push(c);

    let label = '';
    if (parentRaw !== '' && childRaw !== '' && parentRaw.toLowerCase() !== childRaw.toLowerCase()) {
      // Combine parent tier category with child subheader
      label = `${parentRaw} ${childRaw}`;
    } else if (childRaw !== '') {
      label = childRaw;
    } else if (parentRaw !== '') {
      label = parentRaw;
    } else {
      label = `Column ${c + 1}`;
    }

    originalHeaders.push(label.slice(0, 256));
  }

  // Ensure at least one column remains even if entirely empty
  if (originalHeaders.length === 0) {
    activeColumnIndices.push(0);
    originalHeaders.push('Column 1');
  }

  const sanitizedKeys = sanitiseHeaders(originalHeaders);

  return {
    detectedRowIndex: bestRowIndex,
    confidence,
    originalHeaders,
    sanitizedKeys,
    activeColumnIndices,
  };
}
