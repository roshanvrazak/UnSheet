import type { SafeIdentifier } from '@unsheet/contracts';
import { isEmptySpacerRow, isSubtotalRow } from './noise.js';
import { sanitiseHeaders } from './sanitise.js';

export interface HeaderDetectionResult {
  detectedRowIndex: number;
  confidence: number;
  originalHeaders: string[];
  sanitizedKeys: SafeIdentifier[];
}

/**
 * Automatically detects the true header row within a 2D spreadsheet grid.
 * Evaluates candidate rows up to row 20 using string density, fill ratio,
 * distinctness, and type transitions into subsequent data rows.
 */
export function detectHeaderRow(grid: unknown[][]): HeaderDetectionResult {
  if (!grid || grid.length === 0) {
    return {
      detectedRowIndex: 0,
      confidence: 0,
      originalHeaders: ['Column 1'],
      sanitizedKeys: sanitiseHeaders(['Column 1']),
    };
  }

  // Calculate the maximum column width across the grid
  let maxCols = 0;
  for (const row of grid) {
    if (row.length > maxCols) {
      maxCols = row.length;
    }
  }

  if (maxCols === 0) {
    return {
      detectedRowIndex: 0,
      confidence: 0,
      originalHeaders: ['Column 1'],
      sanitizedKeys: sanitiseHeaders(['Column 1']),
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
      const str = String(val).trim();
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
      if (typeof row[c] === 'string' && String(row[c]).trim() !== '') {
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
        const str = String(val).trim();
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

  // Extract original headers from bestRowIndex
  const headerRow = grid[bestRowIndex] ?? [];
  const originalHeaders: string[] = [];

  for (let c = 0; c < maxCols; c++) {
    const val = headerRow[c];
    let label = val !== null && val !== undefined ? String(val).trim() : '';
    if (label === '') {
      label = `Column ${c + 1}`;
    }
    // Truncate to maximum 256 characters per contracts schema
    originalHeaders.push(label.slice(0, 256));
  }

  const sanitizedKeys = sanitiseHeaders(originalHeaders);

  return {
    detectedRowIndex: bestRowIndex,
    confidence,
    originalHeaders,
    sanitizedKeys,
  };
}
