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
    <div role="region" aria-label={spec.title} className="widget-card metric-card flex h-full flex-col justify-between">
      <div>
        <div className="metric-header">
          <h3>{spec.title}</h3>
          <span className="metric-icon"><MetricIcon size={15} aria-hidden="true" /></span>
        </div>
        <div className="metric-value">{formattedValue}</div>
      </div>
      <div className="metric-footer">
        <div className="space-y-1">
          <span className="block">{spec.description || 'Across all matching records'}</span>
          {changeBadge && (
          <span className={cn('inline-flex items-center gap-1', changeBadge.direction === 'positive' ? 'text-emerald-700' : changeBadge.direction === 'negative' ? 'text-rose-700' : 'text-slate-600')}>
            {changeBadge.direction === 'positive' ? <TrendingUp size={13} aria-hidden="true" /> : changeBadge.direction === 'negative' ? <TrendingDown size={13} aria-hidden="true" /> : <Minus size={13} aria-hidden="true" />}
            <span>{changeBadge.text}</span>{changeBadge.label && <span>{changeBadge.label}</span>}
          </span>
          )}
        </div>
        <span className="metric-aggregation">{spec.aggregation}</span>
      </div>
    </div>
  );
}
