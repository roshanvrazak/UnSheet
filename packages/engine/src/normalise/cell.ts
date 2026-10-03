/**
 * Safely converts an arbitrary value to a string, gracefully handling
 * null-prototype objects (Object.create(null)) without throwing
 * "TypeError: Cannot convert object to primitive value".
 */
export function safeToString(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'string') {
    return val;
  }
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint') {
    return String(val);
  }
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? '' : val.toISOString();
  }
  if (typeof val === 'object') {
    try {
      if (Object.getPrototypeOf(val) === null) {
        return '';
      }
      return String(val);
    } catch {
      return '';
    }
  }
  try {
    return String(val);
  } catch {
    return '';
  }
}

/**
 * Normalises an arbitrary raw spreadsheet cell value into a clean, JSON-serializable value.
 * Empty cells, whitespace strings, and invalid numbers are mapped to null.
 * Dates are converted to ISO 8601 strings.
 * Leading/trailing whitespace on string cells is trimmed.
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
    // REV-P1-06: Return trimmed string to eliminate messy leading/trailing whitespace
    return trimmed;
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

  if (typeof raw === 'object') {
    try {
      if (Object.getPrototypeOf(raw) === null) {
        return null;
      }
      return String(raw);
    } catch {
      return null;
    }
  }

  try {
    return String(raw);
  } catch {
    return null;
  }
}
