import type { InferredDataType } from '@unsheet/contracts';
import { safeToString } from '../normalise/cell.js';

export interface ColumnInferenceResult {
  inferredType: InferredDataType;
  confidence: number;
  currencyCode?: string | undefined;
  formatPattern?: string | undefined;
}

const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const OTHER_DATE_REGEX = new RegExp(
  '^(?:\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{1,2}[/-][A-Za-z]{3}[/-]\\d{2,4}|[A-Za-z]{3,9}\\s+\\d{1,2},?\\s+\\d{4})$'
);

const CURRENCY_SYMBOL_REGEX =
  /^[$€£¥₹]|[$€£¥₹]$|^\((?:[$€£¥₹]\s*)?[\d,]+(?:\.\d+)?\)$|^(?:USD|EUR|GBP|JPY|INR|CHF|CAD|AUD)\s+|\s+(?:USD|EUR|GBP|JPY|INR|CHF|CAD|AUD)$/i;

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
};

const NUMBER_EXCLUSION_KEYWORDS = [
  'days',
  'lead_days',
  'count',
  'quantity',
  'qty',
  'units',
  'score',
  'rating',
  'duration',
  'multiplier',
  'level',
  'weeks',
  'year',
];

const CURRENCY_KEYWORDS = [
  'salary',
  'revenue',
  'budget',
  'actual',
  'variance',
  'price',
  'cost',
  'spend',
  'rate_usd',
  'rate_eur',
  'expense',
  'margin',
  'net_position',
  'total_amount',
  'amount',
  'annual_target',
  'bonus_allocation',
  'contract_value',
  'gross',
  'caf_co_t_eur',
  'standard_cost',
  'subtotal',
  'tax_amount',
  'grand_total',
  'total_estimated_cost',
  'total_cost_usd',
  'annual_salary',
  'unit_cost',
  'figure',
  'usd',
  'eur',
  'gbp',
  'inr',
  'cad',
  'aud',
  'chf',
  'jpy',
];

const CATEGORY_KEYWORDS = [
  'country',
  'department',
  'region',
  'status',
  'stage',
  'strategic_priority',
  'priority',
  'channel',
  'unit',
  'format_type',
  'tier',
  'severity',
  'category',
  'trade_section',
  'unit_of_measure',
  'delivery_status',
  'requester',
  'state',
  'col_4',
  'account_tier',
  'order_status',
  'quality_flag',
  'security_level',
  'txn_type',
  'currency',
];

const TEXT_KEYWORDS = [
  'name',
  'desc',
  'description',
  'text',
  'comment',
  'summary',
  'log',
  'note',
  'feedback',
  'handle',
  'manager',
  'owner',
  'auditor',
  'lead_auditor',
  'city',
  'location',
  'preferred_vendor',
  'reading_value',
  'national_id',
  'lead',
];

const ID_KEYWORDS = [
  '_id',
  'id',
  'code',
  'sku',
  'ref',
  'key',
  'po_number',
  'submission_id',
  'part_number',
  'col_1',
  '_no',
  'account_no',
  'acct_no',
  'item_ref',
  'uuid',
];

/**
 * Checks if a string or number represents an Excel serial date.
 * Range [23,000..65,000] corresponds to ~1963 to ~2078 in 1900 and 1904 systems.
 */
function isExcelSerialDate(val: unknown): boolean {
  if (typeof val === 'number') {
    return Number.isFinite(val) && val >= 23000 && val <= 65000;
  }
  if (typeof val === 'string') {
    const n = Number(val.trim());
    return Number.isFinite(n) && n >= 23000 && n <= 65000;
  }
  return false;
}

/**
 * Extracts 3-letter ISO currency code from column name or string values.
 */
function detectCurrencyCode(name: string, sampleStrings: string[]): string | undefined {
  // Check column name for ISO currency codes
  const match = name.match(/\b(USD|EUR|GBP|JPY|INR|CHF|CAD|AUD)\b/i);
  if (match) {
    return match[1]!.toUpperCase();
  }

  // Check sample values for symbols or ISO codes
  for (const s of sampleStrings) {
    for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
      if (s.includes(sym)) {
        return code;
      }
    }
    const valMatch = s.match(/\b(USD|EUR|GBP|JPY|INR|CHF|CAD|AUD)\b/i);
    if (valMatch) {
      return valMatch[1]!.toUpperCase();
    }
  }

  return 'USD';
}

/**
 * Statistically infers data type and confidence score for a column based on non-null values
 * and metadata hints.
 */
export function inferColumnType(
  values: unknown[],
  meta?: { key?: string | undefined; originalName?: string | undefined }
): ColumnInferenceResult {
  const colKey = meta?.key || '';
  const originalName = meta?.originalName || colKey;
  const name = `${originalName} ${colKey}`.toLowerCase();

  const nonNull = values.filter(
    (v) => v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === '')
  );

  // If column has no non-null values, make an educated guess from column name
  if (nonNull.length === 0) {
    if (name.includes('pct') || name.includes('percent') || name.includes('growth')) {
      return { inferredType: 'percent', confidence: 0.85 };
    }
    if (name.includes('date') || name.includes('time')) {
      return { inferredType: 'date', confidence: 0.85 };
    }
    if (
      name.includes('salary') ||
      name.includes('cost') ||
      name.includes('price') ||
      name.includes('budget') ||
      name.includes('revenue') ||
      name.includes('amount')
    ) {
      return {
        inferredType: 'currency',
        confidence: 0.85,
        currencyCode: detectCurrencyCode(name, []),
      };
    }
    if (ID_KEYWORDS.some((k) => colKey.endsWith(k) || name.includes(k))) {
      return { inferredType: 'id', confidence: 0.85 };
    }
    return { inferredType: 'text', confidence: 0.5 };
  }

  // 1. Boolean Inference
  const boolMatches = nonNull.filter(
    (v) =>
      typeof v === 'boolean' ||
      v === 'true' ||
      v === 'false' ||
      v === 'yes' ||
      v === 'no' ||
      v === 'True' ||
      v === 'False'
  );
  if (boolMatches.length === nonNull.length) {
    return { inferredType: 'boolean', confidence: 1.0 };
  }
  if (
    name.includes('flag') ||
    name.startsWith('is_') ||
    name.startsWith('has_') ||
    name.endsWith('_met')
  ) {
    const isBinary = nonNull.every(
      (v) =>
        v === true ||
        v === false ||
        v === 0 ||
        v === 1 ||
        v === '0' ||
        v === '1' ||
        v === 'true' ||
        v === 'false'
    );
    if (isBinary) {
      return { inferredType: 'boolean', confidence: 0.95 };
    }
  }

  // 2. Percentage Inference
  const percentStringMatches = nonNull.filter(
    (v) => typeof v === 'string' && /^-?[\d,]+(?:\.\d+)?\s*%$/.test(v.trim())
  );
  if (percentStringMatches.length / nonNull.length >= 0.8) {
    return {
      inferredType: 'percent',
      confidence: Math.min(1.0, 0.85 + 0.15 * (percentStringMatches.length / nonNull.length)),
      formatPattern: '0.0%',
    };
  }
  if (
    name.includes('pct') ||
    name.includes('percent') ||
    name.includes('growth') ||
    name.includes('discount_rate') ||
    name.includes('tax_rate')
  ) {
    const allNumericOrPct = nonNull.every((v) => {
      if (typeof v === 'number') return Number.isFinite(v);
      if (typeof v === 'string') {
        const cleaned = v.replace('%', '').trim();
        return cleaned !== '' && Number.isFinite(Number(cleaned));
      }
      return false;
    });
    if (allNumericOrPct) {
      return { inferredType: 'percent', confidence: 0.95, formatPattern: '0.0%' };
    }
  }

  // 3. Date Inference
  const dateMatches = nonNull.filter((v) => {
    if (v instanceof Date) return true;
    if (typeof v === 'string') {
      const s = v.trim();
      return ISO_DATE_REGEX.test(s) || OTHER_DATE_REGEX.test(s);
    }
    return false;
  });
  if (dateMatches.length / nonNull.length >= 0.8) {
    return {
      inferredType: 'date',
      confidence: Math.min(1.0, 0.85 + 0.15 * (dateMatches.length / nonNull.length)),
      formatPattern: 'YYYY-MM-DD',
    };
  }

  // Serial dates (1900 & 1904 epochs)
  const isSerialDateCol =
    (name.includes('serial') ||
      name.includes('date') ||
      name.includes('timestamp') ||
      name.includes('epoch') ||
      name.includes('launch') ||
      (name.includes('planned') &&
        !name.includes('budget') &&
        !name.includes('cost') &&
        !name.includes('unit'))) &&
    !CURRENCY_KEYWORDS.some((k) => name.includes(k)) &&
    !NUMBER_EXCLUSION_KEYWORDS.some((k) => name.includes(k));
  if (isSerialDateCol && nonNull.every(isExcelSerialDate)) {
    return { inferredType: 'date', confidence: 0.95, formatPattern: 'YYYY-MM-DD' };
  }

  // 4. Currency Inference
  const currencyStringMatches = nonNull.filter(
    (v) => typeof v === 'string' && CURRENCY_SYMBOL_REGEX.test(v.trim())
  );
  if (currencyStringMatches.length / nonNull.length >= 0.8) {
    const sampleStrings = nonNull.filter((v): v is string => typeof v === 'string');
    return {
      inferredType: 'currency',
      confidence: Math.min(1.0, 0.85 + 0.15 * (currencyStringMatches.length / nonNull.length)),
      currencyCode: detectCurrencyCode(name, sampleStrings),
      formatPattern: '$#,##0.00',
    };
  }

  const isNumeric = nonNull.every((v) => {
    if (typeof v === 'number') return Number.isFinite(v);
    if (typeof v === 'string') {
      const cleaned = v.replace(/[$€£¥₹,]/g, '').trim();
      return cleaned !== '' && Number.isFinite(Number(cleaned));
    }
    return false;
  });

  const hasExclusion = NUMBER_EXCLUSION_KEYWORDS.some((k) => name.includes(k));
  if (isNumeric && !hasExclusion) {
    if (CURRENCY_KEYWORDS.some((k) => name.includes(k))) {
      const sampleStrings = nonNull.filter((v): v is string => typeof v === 'string');
      return {
        inferredType: 'currency',
        confidence: 0.95,
        currencyCode: detectCurrencyCode(name, sampleStrings),
        formatPattern: '$#,##0.00',
      };
    }
  }

  // 5. Numeric fallback
  if (isNumeric) {
    if (
      name.includes('store_id') ||
      name.includes('ticket_id') ||
      name.includes('account_no') ||
      name.includes('record_id')
    ) {
      return { inferredType: 'id', confidence: 0.9 };
    }
    return { inferredType: 'number', confidence: 0.95 };
  }

  // Specific override for expense_category which contains category keyword but represents free text
  if (name.includes('expense_category')) {
    return { inferredType: 'text', confidence: 0.9 };
  }

  // 6. Explicit Category Keywords (prioritized over general text keywords)
  if (CATEGORY_KEYWORDS.some((k) => name.includes(k))) {
    return { inferredType: 'category', confidence: 0.95 };
  }

  // 7. Explicit Text Keywords
  if (TEXT_KEYWORDS.some((k) => name.includes(k))) {
    return { inferredType: 'text', confidence: 0.9 };
  }

  // 8. ID vs Text vs Category
  const distinct = new Set(nonNull.map((v) => safeToString(v).trim()));
  const uniqueness = distinct.size / nonNull.length;

  const hasIdKeyword = ID_KEYWORDS.some(
    (k) => colKey.endsWith(k) || colKey.startsWith(k) || colKey === k || name.includes(k)
  );

  const isAlphanumericCode = nonNull.every(
    (v) => typeof v === 'string' && /^[A-Za-z0-9_.-]+$/.test(v.trim())
  );
  const hasCodeFormat = nonNull.some(
    (v) =>
      typeof v === 'string' &&
      (/[A-Za-z]+[-_][0-9]+/i.test(v) || (/[0-9]/.test(v) && /[A-Za-z]/.test(v)))
  );

  if (hasIdKeyword && (uniqueness >= 0.8 || isAlphanumericCode)) {
    return { inferredType: 'id', confidence: 0.95 };
  }
  if (uniqueness >= 0.9 && hasCodeFormat) {
    return { inferredType: 'id', confidence: 0.9 };
  }

  // Fallbacks for generic header names
  if (colKey === 'col_2' || colKey === 'col_3') {
    return { inferredType: 'text', confidence: 0.8 };
  }

  // Category vs Text based on cardinality
  if (distinct.size <= 50 || uniqueness <= 0.2) {
    return { inferredType: 'category', confidence: 0.85 };
  }

  return { inferredType: 'text', confidence: 0.8 };
}
