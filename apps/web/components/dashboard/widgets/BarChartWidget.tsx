'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { BarChartWidgetSpec, QueryResult } from '@unsheet/contracts';
import { getChartColor } from '@/lib/utils';
import { AccessibleDataTable, type AccessibleTableColumn } from '../AccessibleDataTable';

export interface BarChartWidgetProps {
  spec: BarChartWidgetSpec;
  queryResult?: QueryResult;
}

/**
 * Bar Chart Widget for categorical comparisons.
 * Supports vertical or horizontal layouts, multi-measure bars, and AccessibleDataTable toggle.
 */
export function BarChartWidget({ spec, queryResult }: BarChartWidgetProps) {
  const rows = queryResult?.rows ?? [];
  const isHorizontal = spec.orientation === 'horizontal';

  // Build columns for AccessibleDataTable
  const tableColumns: AccessibleTableColumn[] = [
    {
      key: spec.dimension,
      label: spec.dimension,
    },
    ...spec.measures.map((m) => ({
      key: m,
      label: m,
    })),
  ];

  return (
    <div
      role="region"
      aria-label={spec.title}
      className="widget-card flex flex-col justify-between h-full p-5"
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
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              No data available for selected filters
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <BarChart
                data={rows}
                layout={isHorizontal ? 'vertical' : 'horizontal'}
                margin={{ top: 10, right: 10, left: isHorizontal ? 20 : -10, bottom: 0 }}
              >
                {spec.showGrid !== false && (
                  <CartesianGrid strokeDasharray="3 3" stroke="#edf0e9" />
                )}
                {isHorizontal ? (
                  <>
                    <XAxis
                      type="number"
                      stroke="#647060"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#e0e5dd' }}
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
                    <YAxis
                      dataKey={spec.dimension}
                      type="category"
                      stroke="#647060"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#e0e5dd' }}
                      width={80}
                    />
                  </>
                ) : (
                  <>
                    <XAxis
                      dataKey={spec.dimension}
                      stroke="#647060"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#e0e5dd' }}
                    />
                    <YAxis
                      stroke="#647060"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#e0e5dd' }}
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
                  </>
                )}
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e0e5dd',
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
                {spec.measures.map((measure, idx) => (
                  <Bar
                  isAnimationActive={false}
                    key={measure}
                    dataKey={measure}
                    fill={getChartColor(idx)}
                    {...(spec.stacked ? { stackId: 'stack' } : {})}
                    radius={
                      isHorizontal
                        ? [0, 4, 4, 0]
                        : [4, 4, 0, 0]
                    }
                  />
                ))}
              </BarChart>
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
