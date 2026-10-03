import {
  SafeIdentifierSchema,
  FORBIDDEN_OBJECT_KEYS,
  type SafeIdentifier,
} from '@unsheet/contracts';
import type { Worksheet, Row } from 'exceljs';

const FORBIDDEN_SET = new Set<string>(FORBIDDEN_OBJECT_KEYS);

/**
 * Sanitizes a raw column header string into a valid SafeIdentifier candidate.
 * Aligns strictly with @unsheet/engine's sanitiseHeaderToken.
 */
export function sanitizeHeaderKey(raw: unknown, columnIndex = 0): string {
  const rawStr = String(raw ?? '').trim();

  if (rawStr === '') {
    return `col_${columnIndex + 1}`;
  }

  const rawLower = rawStr.toLowerCase();
  if (
    rawLower === '__proto__' ||
    rawLower === 'constructor' ||
    rawLower === 'prototype'
  ) {
    return `safe_${rawLower}`;
  }

  // Insert underscores between camelCase boundaries (e.g. "firstName" -> "first_name")
  let str = rawStr.replace(/([a-z0-9])([A-Z])/g, '$1_$2');

  // Replace any non-alphanumeric or underscore characters with underscores
  str = str.replace(/[^a-zA-Z0-9_]/g, '_');

  // Collapse multiple consecutive underscores
  str = str.replace(/_+/g, '_');

  // Convert to lowercase for clean, uniform programmatic identifiers
  str = str.toLowerCase();

  // If identifier begins with a digit, prefix with an underscore
  if (/^[0-9]/.test(str)) {
    str = `_${str}`;
  }

  // Strip trailing underscore if longer than 1 character
  if (str.length > 1 && str.endsWith('_')) {
    str = str.slice(0, -1);
  }

  // Strip leading underscore if followed only by symbols, or if empty
  if (str === '' || str === '_') {
    str = `col_${columnIndex + 1}`;
  }

  // Check against forbidden prototype pollution keywords
  if (FORBIDDEN_SET.has(str) || str === '__proto__' || str === 'constructor' || str === 'prototype') {
    str = `safe_${str}`;
  }

  // Truncate to maximum 120 characters to allow room for sequential disambiguation suffixes
  if (str.length > 120) {
    str = str.slice(0, 120);
  }

  return str;
}

/**
 * Disambiguates an array of raw headers into unique SafeIdentifiers with sequential suffixes.
 * Uses a while (seen.has(candidateKey)) loop to prevent collision on pre-indexed headers
 * and parses each key through SafeIdentifierSchema.
 */
export function disambiguateHeaders(rawHeaders: unknown[]): SafeIdentifier[] {
  const seenKeys = new Set<string>();
  const sanitized: SafeIdentifier[] = [];

  for (let i = 0; i < rawHeaders.length; i++) {
    const baseKey = sanitizeHeaderKey(rawHeaders[i], i);
    let key = baseKey;
    let counter = 1;

    // Disambiguate duplicate keys, guaranteeing absolute uniqueness
    while (seenKeys.has(key) || FORBIDDEN_SET.has(key)) {
      key = `${baseKey}_${counter}`;
      counter++;
    }

    seenKeys.add(key);

    // Validate with contract schema (no unchecked casts)
    const validatedKey = SafeIdentifierSchema.parse(key);
    sanitized.push(validatedKey);
  }

  return sanitized;
}

/**
 * Excel 1900 date epoch to ISO date (YYYY-MM-DD).
 * Serial 1 is 1900-01-01. Serial 60 is Lotus 1-2-3 fictitious 1900-02-29.
 */
export function serial1900ToIsoDate(serial: number): string {
  // Whole days
  let days = Math.floor(serial);
  if (days > 60) {
    // Account for the fictitious leap day Feb 29, 1900
    days -= 1;
  }
  // Base is 1899-12-31 UTC
  const baseMs = Date.UTC(1899, 11, 31);
  const targetMs = baseMs + days * 86400000;
  const d = new Date(targetMs);
  return d.toISOString().split('T')[0]!;
}

/**
 * Excel 1904 date epoch to ISO date (YYYY-MM-DD).
 * Serial 0 is 1904-01-01.
 */
export function serial1904ToIsoDate(serial: number): string {
  const days = Math.floor(serial);
  const baseMs = Date.UTC(1904, 0, 1);
  const targetMs = baseMs + days * 86400000;
  const d = new Date(targetMs);
  return d.toISOString().split('T')[0]!;
}

/**
 * Formats a JS Date to ISO YYYY-MM-DD.
 */
export function formatIsoDate(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

/**
 * Applies header row styling to ExcelJS worksheet row.
 */
export function styleHeaderRow(
  row: Row,
  bgColorHex = '1F497D',
  fgColorHex = 'FFFFFF'
): void {
  row.font = { name: 'Calibri', size: 11, bold: true, color: { argb: fgColorHex } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: bgColorHex },
  };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 24;

  row.eachCell({ includeEmpty: false }, (cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'D9D9D9' } },
      left: { style: 'thin', color: { argb: 'D9D9D9' } },
      bottom: { style: 'medium', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: 'D9D9D9' } },
    };
  });
}

/**
 * Auto-fits columns based on content length.
 */
export function autoFitColumns(worksheet: Worksheet, minWidth = 12): void {
  worksheet.columns.forEach((column) => {
    let maxLen = minWidth;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const val = cell.value;
      if (val !== null && val !== undefined) {
        const str = typeof val === 'object' && 'text' in val ? String(val.text) : String(val);
        maxLen = Math.max(maxLen, Math.min(str.length + 3, 50));
      }
    });
    column.width = maxLen;
  });
}
