import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { DisplayFormat } from '@unsheet/contracts';

/**
 * Combines class names with Tailwind merge for clean class resolution.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Standard accessible color palette for categorical charts (Donut, Bar, Line).
 * High-contrast, colorblind-distinguishable hex codes conforming to WCAG AA.
 */
export const CHART_PALETTE: readonly string[] = [
  '#2563eb', // blue-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#e11d48', // rose-600
  '#0891b2', // cyan-600
  '#4f46e5', // indigo-600
  '#ca8a04', // yellow-600
  '#0d9488', // teal-600
  '#9333ea', // purple-600
  '#dc2626', // red-600
  '#475569', // slate-600
] as const;

/**
 * Returns a deterministic color for a given series or slice index.
 */
export function getChartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length] ?? '#2563eb';
}

/**
 * Safely converts any value to a string representation, guarding against
 * Object.create(null) objects that lack toString().
 */
export function safeToString(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'object' && val !== null && !('toString' in val)) {
    return '[object Object]';
  }
  try {
    return String(val);
  } catch {
    return '[object Object]';
  }
}

/**
 * Safely formats any cell value or aggregated measure based on a DisplayFormat specification.
 * Fully injection-safe: neutralizes formula prefixes and returns plain string.
 */
export function formatDisplayValue(
  value: unknown,
  format?: DisplayFormat
): string {
  if (value === null || value === undefined) {
    return '—';
  }

  // Handle boolean values
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }

  // Handle dates
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? 'Invalid Date' : value.toLocaleDateString();
  }

  // Handle numbers / numeric strings
  const num = typeof value === 'number' ? value : Number(value);
  const isNumeric = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(num));

  let rawFormatted: string;

  if (isNumeric && Number.isFinite(num)) {
    const precision = format?.precision ?? (Number.isInteger(num) ? 0 : 2);

    let formattedNumber: string;

    if (format?.currency) {
      try {
        formattedNumber = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: format.currency,
          notation: format.notation === 'compact' ? 'compact' : 'standard',
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        }).format(num);
      } catch {
        // Fallback if currency code is non-standard
        formattedNumber = `$${num.toLocaleString('en-US', {
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        })}`;
      }
    } else if (format?.notation === 'compact') {
      formattedNumber = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: precision,
      }).format(num);
    } else if (format?.notation === 'scientific') {
      formattedNumber = num.toExponential(precision);
    } else {
      formattedNumber = num.toLocaleString('en-US', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      });
    }

    const prefix = format?.prefix ?? '';
    const suffix = format?.suffix ?? '';
    rawFormatted = `${prefix}${formattedNumber}${suffix}`;
  } else {
    // Fallback to string representation
    const str = safeToString(value);
    const prefix = format?.prefix ?? '';
    const suffix = format?.suffix ?? '';
    rawFormatted = `${prefix}${str}${suffix}`;
  }

  // SEC-P3-07: Neutralize formula prefixes (=, +, -, @, \t, \r, |)
  const trimmed = rawFormatted.trimStart();
  if (
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@') ||
    trimmed.startsWith('\t') ||
    trimmed.startsWith('\r') ||
    trimmed.startsWith('|')
  ) {
    return `'${rawFormatted}`;
  }

  return rawFormatted;
}
