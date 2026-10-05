'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, DollarSign, Percent, Hash, Activity, Layers } from 'lucide-react';
import type { KPIWidgetSpec, QueryResult } from '@unsheet/contracts';
import { formatDisplayValue, cn } from '@/lib/utils';

export interface KPIWidgetProps {
  spec: KPIWidgetSpec;
  queryResult?: QueryResult;
}

function getMetricIcon(measure: string, format?: KPIWidgetSpec['format']) {
  const m = measure.toLowerCase();
  if (format?.currency || m.includes('revenue') || m.includes('sales') || m.includes('cost') || m.includes('price') || m.includes('amount') || m.includes('budget')) {
    return DollarSign;
  }
  if (format?.suffix === '%' || m.includes('pct') || m.includes('rate') || m.includes('margin') || m.includes('growth')) {
    return Percent;
  }
  if (m.includes('count') || m.includes('id') || m.includes('units') || m.includes('qty')) {
    return Hash;
  }
  if (m.includes('score') || m.includes('rank') || m.includes('index')) {
    return Layers;
  }
  return Activity;
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

  const MetricIcon = getMetricIcon(spec.measure, spec.format);

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
      className="flex flex-col justify-between h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all"
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <MetricIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 line-clamp-1">
              {spec.title}
            </h3>
          </div>
          {changeBadge && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
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
              {changeBadge.label && (
                <span className="font-normal opacity-85 ml-1">{changeBadge.label}</span>
              )}
            </span>
          )}
        </div>

        <div className="mt-4">
          <div className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
            {formattedValue}
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-3">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 w-3/4" />
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="line-clamp-1">{spec.description}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 ml-2">
          {spec.aggregation}
        </span>
      </div>
    </div>
  );
}
