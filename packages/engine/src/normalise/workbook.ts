import {
  WorkbookModelSchema,
  MAX_FILE_SIZE_BYTES,
  MAX_SHEETS,
  type WorkbookModel,
  type SheetModel,
} from '@unsheet/contracts';
import type { RawWorkbook } from '../parse/sheetjs.js';
import { normaliseSheet, generateSafeEntityId } from './sheet.js';

/**
 * Normalises a raw parsed workbook into a complete, validated WorkbookModel.
 * Strictly guarantees conformity to @unsheet/contracts WorkbookModelSchema.
 */
export function normaliseWorkbook(rawWorkbook: RawWorkbook): WorkbookModel {
  const normalisedSheets: SheetModel[] = [];

  const sheetLimit = Math.min(rawWorkbook.sheets.length, MAX_SHEETS);
  for (let i = 0; i < sheetLimit; i++) {
    const rawSheet = rawWorkbook.sheets[i];
    if (rawSheet) {
      normalisedSheets.push(normaliseSheet(rawSheet, i));
    }
  }

  // Ensure at least one sheet exists
  if (normalisedSheets.length === 0) {
    normalisedSheets.push(
      normaliseSheet(
        {
          name: 'Sheet1',
          grid: [['col_1']],
          merges: [],
        },
        0
      )
    );
  }

  const cleanFilename =
    rawWorkbook.filename.trim().slice(0, 256) || 'workbook.xlsx';

  // Ensure fileSize is a positive integer <= MAX_FILE_SIZE_BYTES
  const fileSize = Math.min(
    Math.max(1, Math.round(rawWorkbook.fileSize)),
    MAX_FILE_SIZE_BYTES
  );

  const workbookModel: WorkbookModel = {
    id: generateSafeEntityId('wb'),
    filename: cleanFilename,
    fileSize,
    sheets: normalisedSheets,
    activeSheetIndex: 0,
    metadata: {
      createdAt: new Date().toISOString(),
      sheetCount: normalisedSheets.length,
      fileType: rawWorkbook.fileType,
      ...(rawWorkbook.sourceHash ? { sourceHash: rawWorkbook.sourceHash } : {}),
    },
  };

  return WorkbookModelSchema.parse(workbookModel);
}
