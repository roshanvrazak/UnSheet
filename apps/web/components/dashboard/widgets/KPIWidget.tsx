'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { KPIWidgetSpec, QueryResult } from '@unsheet/contracts';
import { formatDisplayValue, cn } from '@/lib/utils';

export interface KPIWidgetProps {
  spec: KPIWidgetSpec;
  queryResult?: QueryResult;
}

/**
 * KPI Metric Card Widget.
 * Displays primary measure value, optional target/previous comparison badge, and description.
 */
export function KPIWidget({ spec, queryResult }: KPIWidgetProps) {
  // Extract primary metric value from queryResult
  const primaryRow = queryResult?.rows?.[0];
  const rawValue = primaryRow ? primaryRow[spec.measure] : null;
  const formattedValue = formatDisplayValue(rawValue, spec.format);

  // Compute comparison change if comparison spec is defined
  let changeBadge: {
    text: string;
    direction: 'positive' | 'negative' | 'neutral';
    label?: string | undefined;
  } | null = null;

  if (spec.comparison) {
    const { targetValue, previousValue, periodLabel, changeType = 'percent' } = spec.comparison;
    const baseValue = previousValue ?? targetValue;

    if (baseValue !== undefined && rawValue !== null && typeof rawValue === 'number' && baseValue !== 0) {
      const diff = rawValue - baseValue;
      const isPercent = changeType === 'percent';
      const pctChange = (diff / Math.abs(baseValue)) * 100;

      const direction: 'positive' | 'negative' | 'neutral' =
        diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';

      const changeSign = diff > 0 ? '+' : '';
      const text = isPercent
        ? `${changeSign}${pctChange.toFixed(1)}%`
        : `${changeSign}${formatDisplayValue(diff, spec.format)}`;

      changeBadge = {
        text,
        direction,
        label: periodLabel,
      };
    }
  }

  return (
    <div
      role="region"
      aria-label={spec.title}
      className="flex flex-col justify-between h-full rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow transition-shadow"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {spec.title}
          </h3>
          {changeBadge && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                changeBadge.direction === 'positive' &&
                  'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
                changeBadge.direction === 'negative' &&
                  'bg-rose-50 text-rose-700 border border-rose-200/60',
                changeBadge.direction === 'neutral' &&
                  'bg-slate-50 text-slate-700 border border-slate-200/60'
              )}
            >
              {changeBadge.direction === 'positive' && (
                <TrendingUp className="h-3 w-3" aria-hidden="true" />
              )}
              {changeBadge.direction === 'negative' && (
                <TrendingDown className="h-3 w-3" aria-hidden="true" />
              )}
              {changeBadge.direction === 'neutral' && (
                <Minus className="h-3 w-3" aria-hidden="true" />
              )}
              <span>{changeBadge.text}</span>
            </span>
          )}
        </div>

        <div className="mt-3">
          <div className="text-3xl font-extrabold tracking-tight text-slate-900">
            {formattedValue}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span className="line-clamp-1">{spec.description}</span>
        {changeBadge?.label && (
          <span className="text-[11px] text-slate-400 shrink-0">
            {changeBadge.label}
          </span>
        )}
      </div>
    </div>
  );
}
