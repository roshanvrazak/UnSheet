import type { SafeIdentifier } from '@unsheet/contracts';
import { FORBIDDEN_OBJECT_KEYS } from '@unsheet/contracts';
import type { Worksheet, Row } from 'exceljs';

/**
 * Sanitizes a raw header string into a valid SafeIdentifier conforming to contracts.
 */
export function sanitizeHeaderKey(raw: string, fallbackIndex = 0): SafeIdentifier {
  if (!raw || typeof raw !== 'string') {
    return `col_${fallbackIndex}` as SafeIdentifier;
  }

  // Remove leading/trailing whitespace
  let clean = raw.trim();

  // Handle common symbols and punctuation
  clean = clean
    .replace(/[#$€£¥%&/\\()[\],.?*!@^+=<>:;"'~`|]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();

  // Strip non-alphanumeric/non-underscore characters
  clean = clean.replace(/[^a-z0-9_]/g, '');

  // If starts with digit, prepend 'col_'
  if (/^[0-9]/.test(clean)) {
    clean = `col_${clean}`;
  }

  // If empty or invalid, fallback
  if (!clean || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(clean)) {
    clean = `col_${fallbackIndex}`;
  }

  // Neutralize prototype pollution vectors
  if (FORBIDDEN_OBJECT_KEYS.includes(clean as typeof FORBIDDEN_OBJECT_KEYS[number])) {
    clean = `col_${clean}`;
  }

  // Cap at 128 characters
  if (clean.length > 128) {
    clean = clean.slice(0, 128);
  }

  return clean as SafeIdentifier;
}

/**
 * Disambiguates an array of raw headers into unique SafeIdentifiers with sequential suffixes.
 */
export function disambiguateHeaders(rawHeaders: string[]): SafeIdentifier[] {
  const seenCount = new Map<string, number>();
  const result: SafeIdentifier[] = [];

  for (let i = 0; i < rawHeaders.length; i++) {
    const raw = rawHeaders[i] ?? `col_${i}`;
    const baseKey = sanitizeHeaderKey(raw, i);
    const count = seenCount.get(baseKey) ?? 0;
    seenCount.set(baseKey, count + 1);

    if (count === 0) {
      result.push(baseKey);
    } else {
      const uniqueKey = `${baseKey}_${count}` as SafeIdentifier;
      result.push(uniqueKey);
    }
  }

  return result;
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
