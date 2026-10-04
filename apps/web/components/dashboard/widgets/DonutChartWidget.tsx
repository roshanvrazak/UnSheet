'use client';

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import type { DonutChartWidgetSpec, QueryResult } from '@unsheet/contracts';
import { getChartColor } from '@/lib/utils';
import { AccessibleDataTable, type AccessibleTableColumn } from '../AccessibleDataTable';

export interface DonutChartWidgetProps {
  spec: DonutChartWidgetSpec;
  queryResult?: QueryResult;
}

/**
 * Donut Chart Widget for categorical distribution & composition analysis.
 * Features customizable inner radius, percentage tooltip, color palette, and AccessibleDataTable toggle.
 */
export function DonutChartWidget({ spec, queryResult }: DonutChartWidgetProps) {
  const rows = queryResult?.rows ?? [];

  // Compute total for percentage calculation
  const total = rows.reduce((acc, row) => {
    const val = Number(row[spec.measure]);
    return acc + (Number.isNaN(val) ? 0 : val);
  }, 0);

  // Compute innerRadius ratio (default 0.6 = 60%)
  const innerRadiusPct = spec.innerRadius !== undefined ? spec.innerRadius : 0.6;
  const innerRadiusPx = `${Math.round(innerRadiusPct * 75)}%`;

  // Build columns for AccessibleDataTable
  const tableColumns: AccessibleTableColumn[] = [
    {
      key: spec.dimension,
      label: spec.dimension,
    },
    {
      key: spec.measure,
      label: spec.measure,
    },
  ];

  return (
    <div
      role="region"
      aria-label={spec.title}
      className="flex flex-col justify-between h-full rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow transition-shadow"
    >
      <div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            {spec.title}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{spec.description}</p>
        </div>

        {/* Visual Chart */}
        <div className="mt-4 h-64 w-full">
          {rows.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              No data available for selected filters
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <PieChart>
                <Pie
                  data={rows}
                  dataKey={spec.measure}
                  nameKey={spec.dimension}
                  innerRadius={innerRadiusPx}
                  outerRadius="80%"
                  paddingAngle={2}
                >
                  {rows.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getChartColor(index)}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: unknown) => {
                    const numVal = Number(val);
                    const pct =
                      total > 0 && !Number.isNaN(numVal)
                        ? ` (${((numVal / total) * 100).toFixed(1)}%)`
                        : '';
                    return [`${val}${pct}`, spec.measure];
                  }}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                {spec.showLegend !== false && (
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  />
                )}
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Accessible Table Companion */}
      <AccessibleDataTable
        title={spec.title}
        columns={tableColumns}
        rows={rows}
      />
    </div>
  );
}
