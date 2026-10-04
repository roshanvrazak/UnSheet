'use client';

import React, { useMemo } from 'react';
import type { PivotTableWidgetSpec, QueryResult } from '@unsheet/contracts';
import { formatDisplayValue } from '@/lib/utils';

export interface PivotTableWidgetProps {
  spec: PivotTableWidgetSpec;
  queryResult?: QueryResult;
}

/**
 * Pivot Table Matrix Widget.
 * Cross-tabulates row dimensions against column dimensions with aggregated measure cells and totals.
 */
export function PivotTableWidget({ spec, queryResult }: PivotTableWidgetProps) {
  const rows = useMemo(() => queryResult?.rows ?? [], [queryResult?.rows]);

  const rowDim = spec.rowDimensions[0]!;
  const colDim = spec.colDimensions?.[0];
  const primaryMeasure = spec.measures[0]!;
  const measureKey = primaryMeasure.columnKey;

  // Compute 2D Pivot Data
  const { rowValues, colValues, matrix, rowTotals, colTotals, grandTotal } = useMemo(() => {
    const rowSet = new Set<string>();
    const colSet = new Set<string>();
    const cellMap = new Map<string, number>();

    for (const r of rows) {
      const rVal = String(r[rowDim] ?? '—');
      rowSet.add(rVal);

      const cVal = colDim ? String(r[colDim] ?? '—') : 'Value';
      colSet.add(cVal);

      const mVal = Number(r[measureKey]);
      const numVal = Number.isNaN(mVal) ? 0 : mVal;

      const cellKey = `${rVal}:::${cVal}`;
      cellMap.set(cellKey, (cellMap.get(cellKey) ?? 0) + numVal);
    }

    const rList = Array.from(rowSet).sort();
    const cList = Array.from(colSet).sort();

    const rTotals = new Map<string, number>();
    const cTotals = new Map<string, number>();
    let gTotal = 0;

    for (const rVal of rList) {
      let rSum = 0;
      for (const cVal of cList) {
        const val = cellMap.get(`${rVal}:::${cVal}`) ?? 0;
        rSum += val;
        cTotals.set(cVal, (cTotals.get(cVal) ?? 0) + val);
      }
      rTotals.set(rVal, rSum);
      gTotal += rSum;
    }

    return {
      rowValues: rList,
      colValues: cList,
      matrix: cellMap,
      rowTotals: rTotals,
      colTotals: cTotals,
      grandTotal: gTotal,
    };
  }, [rows, rowDim, colDim, measureKey]);

  const showTotals = spec.showTotals !== false;

  return (
    <div
      role="region"
      aria-label={spec.title}
      className="flex flex-col justify-between h-full rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow transition-shadow"
    >
      <div>
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            {spec.title}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{spec.description}</p>
        </div>

        {/* Pivot Matrix Table */}
        <div tabIndex={0} role="region" aria-label="Pivot table scrollable view" className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">
              <tr>
                <th scope="col" className="px-3 py-2.5 whitespace-nowrap bg-slate-100/80">
                  {rowDim}
                </th>
                {colValues.map((cVal) => (
                  <th
                    key={cVal}
                    scope="col"
                    className="px-3 py-2.5 text-right whitespace-nowrap"
                  >
                    {cVal}
                  </th>
                ))}
                {showTotals && (
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right whitespace-nowrap bg-slate-100/60 font-bold"
                  >
                    Total
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rowValues.length === 0 ? (
                <tr>
                  <td
                    colSpan={colValues.length + (showTotals ? 2 : 1)}
                    className="px-4 py-8 text-center text-xs text-slate-400"
                  >
                    No matrix data available
                  </td>
                </tr>
              ) : (
                rowValues.map((rVal) => (
                  <tr key={rVal} className="hover:bg-slate-50/70 transition-colors">
                    <th
                      scope="row"
                      className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap bg-slate-50/30"
                    >
                      {rVal}
                    </th>
                    {colValues.map((cVal) => {
                      const val = matrix.get(`${rVal}:::${cVal}`) ?? null;
                      return (
                        <td
                          key={cVal}
                          className="px-3 py-2 text-right whitespace-nowrap font-mono text-slate-600"
                        >
                          {val !== null
                            ? formatDisplayValue(val, primaryMeasure.format)
                            : '—'}
                        </td>
                      );
                    })}
                    {showTotals && (
                      <td className="px-3 py-2 text-right whitespace-nowrap font-mono font-semibold text-slate-900 bg-slate-50/40">
                        {formatDisplayValue(rowTotals.get(rVal) ?? 0, primaryMeasure.format)}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {showTotals && rowValues.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <tr>
                  <th scope="row" className="px-3 py-2.5 font-bold">
                    Total
                  </th>
                  {colValues.map((cVal) => (
                    <td
                      key={cVal}
                      className="px-3 py-2.5 text-right whitespace-nowrap font-mono font-bold"
                    >
                      {formatDisplayValue(colTotals.get(cVal) ?? 0, primaryMeasure.format)}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right whitespace-nowrap font-mono font-extrabold text-blue-600 bg-slate-100/80">
                    {formatDisplayValue(grandTotal, primaryMeasure.format)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600">
        <span>Measure: {primaryMeasure.label || measureKey}</span>
        <span>
          {rowValues.length} rows × {colValues.length} columns
        </span>
      </div>
    </div>
  );
}
