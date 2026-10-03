import {
  SafeIdentifierSchema,
  FORBIDDEN_OBJECT_KEYS,
  type SafeIdentifier,
} from '@unsheet/contracts';

const FORBIDDEN_SET = new Set<string>(FORBIDDEN_OBJECT_KEYS);

/**
 * Sanitises a raw column header string into a single valid SafeIdentifier candidate.
 */
export function sanitiseHeaderToken(raw: unknown, columnIndex: number): string {
  const rawStr = (raw !== null && raw !== undefined ? String(raw) : '').trim();

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
 * Converts a list of raw header strings into unique SafeIdentifier column keys,
 * preventing prototype pollution and resolving duplicates with sequential suffixes.
 */
export function sanitiseHeaders(rawHeaders: unknown[]): SafeIdentifier[] {
  const seenKeys = new Set<string>();
  const sanitized: SafeIdentifier[] = [];

  for (let i = 0; i < rawHeaders.length; i++) {
    const baseKey = sanitiseHeaderToken(rawHeaders[i], i);
    let key = baseKey;
    let counter = 1;

    // Disambiguate duplicate keys
    while (seenKeys.has(key) || FORBIDDEN_SET.has(key)) {
      key = `${baseKey}_${counter}`;
      counter++;
    }

    seenKeys.add(key);

    // Validate with contract schema
    const validatedKey = SafeIdentifierSchema.parse(key);
    sanitized.push(validatedKey);
  }

  return sanitized;
}
