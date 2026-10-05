import type { InferredDataType, SemanticRole } from '@unsheet/contracts';

const TIME_KEYWORDS = [
  'date',
  'time',
  'timestamp',
  'datetime',
  'year',
  'quarter',
  'month',
  'day',
  'week',
  'period',
  'epoch',
  'created',
  'updated',
  'closed',
  'opened',
  'completed',
  'started',
  'resolved',
  'shipped',
  'due',
  'deadline',
  'dob',
  'birthday',
  'timeline',
  'hired',
];

const DURATION_METRIC_KEYWORDS = [
  'duration',
  'lead_days',
  'days_to',
  'elapsed',
  'latency',
  'cycle_time',
  'response_time',
  'days_open',
  'lead_time',
  'hours_spent',
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

  const isDurationMetric = DURATION_METRIC_KEYWORDS.some((k) => name.includes(k));
  const isTimeNamed =
    TIME_KEYWORDS.some((k) => name.includes(k) || key.toLowerCase().endsWith(k)) ||
    key.toLowerCase().endsWith('_at') ||
    key.toLowerCase().endsWith('_on');

  // 1. Time Role (Dates, timestamps, years, quarters, temporal axes)
  if (inferredType === 'date' && !isDurationMetric) {
    return 'time';
  }
  if (isTimeNamed && !isDurationMetric) {
    return 'time';
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

  // 3. Measure Role (aggregatable continuous metrics, strictly excluding dates/times)
  if (
    (inferredType === 'number' ||
      inferredType === 'currency' ||
      inferredType === 'percent') &&
    !isTimeNamed
  ) {
    return 'measure';
  }

  // 4. Dimension Role (discrete categoricals, status flags, low cardinality, booleans, text)
  return 'dimension';
}
