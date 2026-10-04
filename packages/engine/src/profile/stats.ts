import type {
  CategoryFrequency,
  InferredDataType,
  NumericStats,
} from '@unsheet/contracts';
import {
  CategoryFrequencySchema,
  SampleValuesArraySchema,
  SampleValueSchema,
} from '@unsheet/contracts';
import { safeToString } from '../normalise/cell.js';

const FORMULA_TRIGGER_REGEX = /^[=+\-@\t\r\n|]/;

/**
 * Sanitises a string value against spreadsheet formula injection triggers
 * (=, +, -, @, \t, \r, \n, |), ensuring it safely passes CategoryFrequencySchema.
 * Max length is capped at 100 characters.
 */
export function sanitizeCategoryValue(rawVal: unknown): string {
  if (rawVal === null || rawVal === undefined) {
    return 'null';
  }

  let str = safeToString(rawVal).trim();
  if (str === '') {
    return '(empty)';
  }

  // If value or trimmed string starts with a formula trigger character, escape with single quote
  if (FORMULA_TRIGGER_REGEX.test(str) || FORMULA_TRIGGER_REGEX.test(str.trimStart())) {
    str = `'${str}`;
  }

  // Cap at 100 characters
  if (str.length > 100) {
    str = str.slice(0, 100);
  }

  // Safety fallback if single quote wasn't enough or trailing cut exposed trigger
  while ((FORMULA_TRIGGER_REGEX.test(str) || FORMULA_TRIGGER_REGEX.test(str.trimStart())) && str.length > 0) {
    str = `'${str.trimStart().replace(FORMULA_TRIGGER_REGEX, '')}`;
  }

  if (str.length > 100) {
    str = str.slice(0, 100);
  }

  // Final validation against contract schema
  const parsed = CategoryFrequencySchema.shape.value.safeParse(str);
  if (!parsed.success) {
    return str.replace(/^[=+\-@\t\r\n|]+/g, '').slice(0, 100) || 'value';
  }

  return str;
}

/**
 * Sanitises a sample value string against spreadsheet formula injection triggers
 * (=, +, -, @, \t, \r, \n, |), ensuring it safely passes SampleValueSchema.
 * Max length is capped at 40 characters.
 */
export function sanitizeSampleValue(rawVal: unknown): string {
  if (rawVal === null || rawVal === undefined) {
    return '';
  }

  let str = safeToString(rawVal).trim();
  if (str === '') {
    return '';
  }

  // If value starts with formula trigger character, prefix with single quote
  if (FORMULA_TRIGGER_REGEX.test(str) || FORMULA_TRIGGER_REGEX.test(str.trimStart())) {
    str = `'${str}`;
  }

  // Cap at 40 characters
  if (str.length > 40) {
    str = str.slice(0, 40);
  }

  // If slicing caused an issue or still triggers
  while ((FORMULA_TRIGGER_REGEX.test(str) || FORMULA_TRIGGER_REGEX.test(str.trimStart())) && str.length > 0) {
    str = `'${str.replace(/^[=+\-@\t\r\n|]+/g, '')}`;
  }

  if (str.length > 40) {
    str = str.slice(0, 40);
  }

  const parsed = SampleValueSchema.safeParse(str);
  if (!parsed.success) {
    return str.replace(/^[=+\-@\t\r\n|]+/g, '').slice(0, 40);
  }

  return str;
}

/**
 * Parses an arbitrary value into a finite number if possible.
 * Handles accounting negatives like "(1,234.50)", currency symbols, and percentages.
 */
export function parseNumericValue(val: unknown): number | null {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val !== 'string') {
    return null;
  }

  let str = val.trim();
  if (str === '') {
    return null;
  }

  let isNegative = false;
  // Accounting parentheses: (1,234.50) or ($1,234.50)
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }

  // Remove currency symbols, commas, and percentage signs
  str = str.replace(/[$€£¥₹]/g, '').replace(/,/g, '').replace(/%/g, '').trim();

  // Handle leading minus
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1).trim();
  } else if (str.startsWith('+')) {
    str = str.slice(1).trim();
  }

  const num = Number(str);
  if (!Number.isFinite(num)) {
    return null;
  }

  return isNegative ? -num : num;
}

export interface ColumnStatsResult {
  nullable: boolean;
  nullCount: number;
  totalCount: number;
  distinctCount: number;
  uniquenessRatio: number;
  stats?: NumericStats | undefined;
  topValues?: CategoryFrequency[] | undefined;
  sampleValues: string[];
}

/**
 * Computes complete column statistics, frequency distributions, and capped sample values
 * fully conforming to @unsheet/contracts.
 */
export function computeColumnStats(
  values: unknown[],
  inferredType: InferredDataType
): ColumnStatsResult {
  const totalCount = values.length;
  let nullCount = 0;
  const nonNullValues: unknown[] = [];
  const distinctSet = new Set<string>();

  for (const v of values) {
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) {
      nullCount++;
    } else {
      nonNullValues.push(v);
      distinctSet.add(safeToString(v));
    }
  }

  const distinctCount = distinctSet.size;
  const uniquenessRatio =
    totalCount === 0 ? 0 : Math.min(1, Math.max(0, Number((distinctCount / totalCount).toFixed(4))));
  const nullable = nullCount > 0;

  // 1. Numeric Statistics
  let stats: NumericStats | undefined;
  if (inferredType === 'number' || inferredType === 'currency' || inferredType === 'percent') {
    const nums: number[] = [];
    for (const v of nonNullValues) {
      const parsed = parseNumericValue(v);
      if (parsed !== null && Number.isFinite(parsed)) {
        nums.push(parsed);
      }
    }

    if (nums.length > 0) {
      let min = nums[0]!;
      let max = nums[0]!;
      let sum = 0;

      for (const n of nums) {
        if (n < min) min = n;
        if (n > max) max = n;
        sum += n;
      }

      const mean = sum / nums.length;

      // Median
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 !== 0
          ? sorted[mid]!
          : (sorted[mid - 1]! + sorted[mid]!) / 2;

      // Variance and Standard Deviation
      let varianceSum = 0;
      for (const n of nums) {
        varianceSum += (n - mean) ** 2;
      }
      const variance = varianceSum / nums.length;
      const stdDev = Math.sqrt(variance);

      stats = {
        min: Number.isFinite(min) ? min : null,
        max: Number.isFinite(max) ? max : null,
        sum: Number.isFinite(sum) ? sum : null,
        mean: Number.isFinite(mean) ? mean : null,
        median: Number.isFinite(median) ? median : null,
        variance: Number.isFinite(variance) ? variance : null,
        stdDev: Number.isFinite(stdDev) ? stdDev : null,
      };
    }
  }

  // 2. Frequency breakdown (for categories, booleans, or low cardinality)
  let topValues: CategoryFrequency[] | undefined;
  if (
    inferredType === 'category' ||
    inferredType === 'boolean' ||
    distinctCount <= 50
  ) {
    const freqMap = new Map<string, number>();
    for (const v of nonNullValues) {
      const key = safeToString(v);
      freqMap.set(key, (freqMap.get(key) || 0) + 1);
    }

    const sortedEntries = Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);

    topValues = sortedEntries.map(([val, count]) => {
      const percentage =
        totalCount === 0
          ? 0
          : Math.min(100, Math.max(0, Number(((count / totalCount) * 100).toFixed(2))));
      return {
        value: sanitizeCategoryValue(val),
        count,
        percentage,
      };
    });
  }

  // 3. Representative Sample Values (max 5 items, max 40 chars each, formula sanitized)
  const sampleValues: string[] = [];
  const seenSamples = new Set<string>();

  for (const v of nonNullValues) {
    if (sampleValues.length >= 5) break;
    const sanitized = sanitizeSampleValue(v);
    if (sanitized !== '' && !seenSamples.has(sanitized)) {
      seenSamples.add(sanitized);
      sampleValues.push(sanitized);
    }
  }

  // Ensure validated with SampleValuesArraySchema
  const validatedSamples = SampleValuesArraySchema.parse(sampleValues);

  return {
    nullable,
    nullCount,
    totalCount,
    distinctCount,
    uniquenessRatio,
    stats,
    topValues,
    sampleValues: validatedSamples,
  };
}
