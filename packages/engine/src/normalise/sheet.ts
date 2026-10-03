import {
  SheetModelSchema,
  SafeEntityIdSchema,
  FORBIDDEN_OBJECT_KEYS,
  MAX_COLUMNS,
  MAX_ROWS,
  type SheetModel,
  type ColumnMetadata,
  type SafeEntityId,
  type SafeIdentifier,
} from '@unsheet/contracts';
import type { RawSheet } from '../parse/sheetjs.js';
import { applyMergeForwardFill } from './merge.js';
import { detectHeaderRow } from './header.js';
import { removeNoiseRows } from './noise.js';
import { normaliseCellValue } from './cell.js';

/**
 * Generates a valid SafeEntityId string with cryptographically secure randomness.
 */
export function generateSafeEntityId(prefix: string): SafeEntityId {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
  const randomBytes = new Uint8Array(6);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const entropy = Array.from(randomBytes, (b) => b.toString(36)).join('').slice(0, 8);
  const candidate = `${cleanPrefix}_${entropy}`;
  return SafeEntityIdSchema.parse(candidate);
}

/**
 * Normalises a raw parsed spreadsheet sheet into a clean, validated SheetModel.
 * Applies merge forward-filling, header detection, spacer column pruning,
 * noise removal, and key sanitisation.
 */
export function normaliseSheet(rawSheet: RawSheet, sheetIndex: number): SheetModel {
  // 1. Forward-fill merged cells
  const mergedGrid = applyMergeForwardFill(rawSheet.grid, rawSheet.merges);

  // 2. Detect headers (including multi-row combination and spacer column pruning)
  const headerResult = detectHeaderRow(mergedGrid);
  const { detectedRowIndex, confidence, originalHeaders, sanitizedKeys, activeColumnIndices } =
    headerResult;

  // 3. Build column metadata
  let columns: ColumnMetadata[] = sanitizedKeys.map((key, idx) => ({
    key,
    originalName: originalHeaders[idx] ?? `Column ${idx + 1}`,
    columnIndex: idx,
  }));

  // Enforce column bounds (max MAX_COLUMNS)
  if (columns.length > MAX_COLUMNS) {
    columns = columns.slice(0, MAX_COLUMNS);
  }

  // 4. Extract data rows (rows below the detected header row)
  const rawDataRows = mergedGrid.slice(detectedRowIndex + 1);

  // 5. Remove noise rows (empty spacers, subtotals, trailing footnotes)
  const cleanDataRows = removeNoiseRows(rawDataRows, columns.length);

  // 6. Normalise cell values and construct safe row records with single-object allocation
  const rows: Array<Record<SafeIdentifier, unknown>> = [];
  const maxRowLimit = Math.min(cleanDataRows.length, MAX_ROWS);
  const activeColIndices = activeColumnIndices ?? columns.map((_, i) => i);

  for (let r = 0; r < maxRowLimit; r++) {
    const rawRow = cleanDataRows[r] ?? [];
    // REV-P1-08: Allocate a single plain object directly
    const record: Record<SafeIdentifier, unknown> = {};

    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      if (!col) continue;
      const sourceColIdx = activeColIndices[c] ?? c;
      const rawCell = rawRow[sourceColIdx];
      record[col.key] = normaliseCellValue(rawCell);
    }

    rows.push(record);
  }

  // SEC-P1-10: Sanitize sheet name against prototype pollution keys
  const rawName = rawSheet.name.trim();
  const isForbidden = (FORBIDDEN_OBJECT_KEYS as readonly string[]).includes(rawName.toLowerCase());
  const sheetName = isForbidden
    ? `safe_${rawName}`
    : rawName.slice(0, 128) || `Sheet ${sheetIndex + 1}`;

  const sheetModel: SheetModel = {
    id: generateSafeEntityId(`sheet_${sheetIndex + 1}`),
    name: sheetName,
    headers: {
      detectedRowIndex,
      confidence,
      originalHeaders: columns.map((col) => col.originalName),
      sanitizedKeys: columns.map((col) => col.key),
    },
    columns,
    rows,
    rowCount: rows.length,
    columnCount: columns.length,
    ...(rawSheet.rawBounds ? { rawBounds: rawSheet.rawBounds } : {}),
  };

  // Validate contract compliance
  return SheetModelSchema.parse(sheetModel);
}
