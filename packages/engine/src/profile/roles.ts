import type { InferredDataType, SemanticRole } from '@unsheet/contracts';

const TIME_KEYWORDS = [
  'date',
  'time',
  'timestamp',
  'year',
  'quarter',
  'month',
  'day',
  'week',
  'period',
  'epoch',
];

const IDENTIFIER_KEYWORDS = [
  'id',
  '_id',
  'key',
  '_key',
  'sku',
  'code',
  'ref',
  'uuid',
  'account_no',
  'po_number',
];

export interface ColumnRoleInput {
  key: string;
  originalName?: string;
  inferredType: InferredDataType;
  uniquenessRatio: number;
  distinctCount: number;
  totalCount: number;
}

/**
 * Assigns a semantic role (dimension, measure, time, identifier) to a column
 * for visualization layout heuristics and SQL query generation.
 */
export function assignSemanticRole(input: ColumnRoleInput): SemanticRole {
  const { key, originalName, inferredType, uniquenessRatio, totalCount } = input;
  const name = `${originalName || ''} ${key}`.toLowerCase();

  // 1. Time Role
  if (inferredType === 'date') {
    return 'time';
  }
  if (TIME_KEYWORDS.some((k) => name.includes(k))) {
    // If it's a numeric year (e.g. 2024), it can act as a time dimension
    if (inferredType === 'number' && (name.includes('year') || name.includes('quarter'))) {
      return 'time';
    }
  }

  // 2. Identifier Role
  if (inferredType === 'id') {
    return 'identifier';
  }
  if (
    uniquenessRatio >= 0.95 &&
    totalCount >= 3 &&
    IDENTIFIER_KEYWORDS.some((k) => key.endsWith(k) || name.includes(k))
  ) {
    return 'identifier';
  }

  // 3. Measure Role (aggregatable continuous metrics)
  if (
    inferredType === 'number' ||
    inferredType === 'currency' ||
    inferredType === 'percent'
  ) {
    return 'measure';
  }

  // 4. Dimension Role (discrete categoricals, status flags, low cardinality, booleans, text)
  return 'dimension';
}
