import { validateUploadGuards, type GuardValidationResult } from './guards.js';
import { parseSheetJs, type RawWorkbook } from './sheetjs.js';
import { computeSha256 } from './hash.js';

export * from './errors.js';
export * from './guards.js';
export * from './zip.js';
export * from './sheetjs.js';
export * from './hash.js';

export interface ParseOptions {
  filename?: string;
  calculateHash?: boolean;
}

/**
 * Validates upload guards and parses a spreadsheet into raw grid models.
 */
export async function parseWorkbook(
  input: ArrayBuffer | Uint8Array,
  options?: ParseOptions
): Promise<RawWorkbook> {
  const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
  const filename = options?.filename ?? 'workbook.xlsx';
  const guardResult: GuardValidationResult = validateUploadGuards(buffer, filename);

  let sourceHash: string | undefined;
  if (options?.calculateHash !== false) {
    sourceHash = await computeSha256(buffer);
  }

  return parseSheetJs(buffer, filename, guardResult.fileType, sourceHash);
}
