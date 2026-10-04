'use client';

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { LineChartWidgetSpec, QueryResult } from '@unsheet/contracts';
import { getChartColor } from '@/lib/utils';
import { AccessibleDataTable, type AccessibleTableColumn } from '../AccessibleDataTable';

export interface LineChartWidgetProps {
  spec: LineChartWidgetSpec;
  queryResult?: QueryResult;
}

/**
 * Line Chart Widget for trend and time-series data.
 * Built with Recharts, responsive layout, styled tooltips, and AccessibleDataTable toggle.
 */
export function LineChartWidget({ spec, queryResult }: LineChartWidgetProps) {
  const rows = queryResult?.rows ?? [];

  // Build columns for AccessibleDataTable
  const tableColumns: AccessibleTableColumn[] = [
    {
      key: spec.timeDimension,
      label: spec.timeDimension,
    },
    ...spec.measures.map((m) => {
      const seriesConfig = spec.series?.find((s) => s.measureKey === m);
      return {
        key: m,
        label: seriesConfig?.label || m,
      };
    }),
  ];

  return (
    <div
      role="region"
      aria-label={spec.title}
      className="flex flex-col justify-between h-full rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow transition-shadow"
    >
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">
              {spec.title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{spec.description}</p>
          </div>
        </div>

        {/* Visual Chart */}
        <div className="mt-4 h-64 w-full" aria-hidden="true">
          {rows.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              No data available for selected filters
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <LineChart
                data={rows}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                {spec.showGrid !== false && (
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                )}
                <XAxis
                  dataKey={spec.timeDimension}
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={(val: number) =>
                    typeof val === 'number'
                      ? val >= 1000000
                        ? `${(val / 1000000).toFixed(1)}M`
                        : val >= 1000
                        ? `${(val / 1000).toFixed(0)}k`
                        : String(val)
                      : String(val)
                  }
                />
                <Tooltip
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
                {spec.measures.map((measure, idx) => {
                  const seriesConfig = spec.series?.find(
                    (s) => s.measureKey === measure
                  );
                  const color = seriesConfig?.color || getChartColor(idx);
                  const strokeDasharray =
                    seriesConfig?.strokeStyle === 'dashed'
                      ? '5 5'
                      : seriesConfig?.strokeStyle === 'dotted'
                      ? '2 2'
                      : undefined;

                  return (
                    <Line
                      key={measure}
                      type="monotone"
                      dataKey={measure}
                      name={seriesConfig?.label || measure}
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray={strokeDasharray}
                      dot={{ r: 3, fill: color }}
                      activeDot={{ r: 5 }}
                    />
                  );
                })}
              </LineChart>
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
