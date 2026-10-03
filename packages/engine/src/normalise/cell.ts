/**
 * Normalises an arbitrary raw spreadsheet cell value into a clean, JSON-serializable value.
 * Empty cells, whitespace strings, and invalid numbers are mapped to null.
 * Dates are converted to ISO 8601 strings.
 */
export function normaliseCellValue(raw: unknown): unknown {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return null;
    }
    return raw;
  }

  if (typeof raw === 'number') {
    if (Number.isNaN(raw) || !Number.isFinite(raw)) {
      return null;
    }
    return raw;
  }

  if (typeof raw === 'boolean') {
    return raw;
  }

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      return null;
    }
    return raw.toISOString();
  }

  // Fallback for symbols, bigints or other unexpected types
  if (typeof raw === 'bigint') {
    return Number(raw);
  }

  return String(raw);
}
