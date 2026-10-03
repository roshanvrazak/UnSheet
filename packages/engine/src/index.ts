import type { Version, WorkbookModel } from '@unsheet/contracts';
import { parseWorkbook, type ParseOptions } from './parse/index.js';
import { normaliseWorkbook } from './normalise/index.js';

export * from './parse/index.js';
export * from './normalise/index.js';

export function getEngineInfo(): Version {
  return {
    version: '0.1.0',
    name: '@unsheet/engine',
  };
}

export type IngestOptions = ParseOptions;

/**
 * End-to-end ingestion pipeline:
 * Validates upload guards, parses spreadsheet file with SheetJS,
 * and normalises sheets into a validated WorkbookModel conforming to @unsheet/contracts.
 */
export async function ingestWorkbook(
  input: ArrayBuffer | Uint8Array,
  options?: IngestOptions
): Promise<WorkbookModel> {
  const rawWorkbook = await parseWorkbook(input, options);
  return normaliseWorkbook(rawWorkbook);
}
