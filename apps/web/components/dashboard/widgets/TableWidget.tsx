'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
} from 'lucide-react';
import type { TableWidgetSpec, QueryResult } from '@unsheet/contracts';
import { formatDisplayValue, cn } from '@/lib/utils';

export interface TableWidgetProps {
  spec: TableWidgetSpec;
  queryResult?: QueryResult;
}

/**
 * Paginated, sortable data table widget.
 * Features in-table search, column sorting, pagination controls, and safe text formatting.
 */
export function TableWidget({ spec, queryResult }: TableWidgetProps) {
  const initialRows = useMemo(() => queryResult?.rows ?? [], [queryResult?.rows]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    columnKey: string;
    direction: 'asc' | 'desc';
  } | null>(
    spec.defaultSort
      ? {
          columnKey: spec.defaultSort.columnKey,
          direction: spec.defaultSort.direction,
        }
      : null
  );
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = spec.pageSize ?? 10;

  // 1. Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) {
      return initialRows;
    }
    const q = searchQuery.toLowerCase().trim();
    return initialRows.filter((row) =>
      spec.columns.some((col) => {
        const val = row[col.columnKey];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      })
    );
  }, [initialRows, searchQuery, spec.columns]);

  // 2. Sort rows
  const sortedRows = useMemo(() => {
    if (!sortConfig) {
      return filteredRows;
    }
    const { columnKey, direction } = sortConfig;
    const sorted = [...filteredRows].sort((a, b) => {
      const valA = a[columnKey];
      const valB = b[columnKey];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      const numA = Number(valA);
      const numB = Number(valB);
      let comparison = 0;
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        comparison = numA < numB ? -1 : 1;
      } else {
        comparison = String(valA).localeCompare(String(valB));
      }

      return direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredRows, sortConfig]);

  // 3. Paginate
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedRows = sortedRows.slice(startIndex, startIndex + pageSize);

  const handleSort = (columnKey: string) => {
    if (spec.sortable === false) return;
    setSortConfig((prev) => {
      if (prev?.columnKey === columnKey) {
        return prev.direction === 'asc'
          ? { columnKey, direction: 'desc' }
          : null;
      }
      return { columnKey, direction: 'asc' };
    });
    setCurrentPage(1);
  };

  return (
    <div
      role="region"
      aria-label={spec.title}
      className="flex flex-col justify-between h-full rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow transition-shadow"
    >
      <div>
        {/* Header and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">
              {spec.title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{spec.description}</p>
          </div>

          {spec.searchable !== false && (
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search table..."
                aria-label="Search table records"
                className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          )}
        </div>

        {/* Table Content */}
        <div tabIndex={0} role="region" aria-label="Data table scrollable view" className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">
              <tr>
                {spec.columns.map((col) => {
                  const isSorted = sortConfig?.columnKey === col.columnKey;
                  const sortDir = sortConfig?.direction;

                  return (
                    <th
                      key={col.columnKey}
                      scope="col"
                      style={col.width ? { width: `${col.width}px` } : undefined}
                      className={cn(
                        'px-3 py-2.5 whitespace-nowrap',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        spec.sortable !== false && 'cursor-pointer select-none hover:bg-slate-100/80 transition-colors'
                      )}
                      onClick={() => handleSort(col.columnKey)}
                      aria-sort={
                        isSorted
                          ? sortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5',
                          col.align === 'right' && 'flex-row-reverse'
                        )}
                      >
                        <span>{col.header}</span>
                        {spec.sortable !== false && (
                          <span className="text-slate-600">
                            {isSorted ? (
                              sortDir === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-blue-600" aria-hidden="true" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-blue-600" aria-hidden="true" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100" aria-hidden="true" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={spec.columns.length}
                    className="px-4 py-8 text-center text-xs text-slate-400"
                  >
                    No matching records found
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {spec.columns.map((col) => (
                      <td
                        key={col.columnKey}
                        className={cn(
                          'px-3 py-2 whitespace-nowrap text-slate-600',
                          col.align === 'right' && 'text-right font-mono',
                          col.align === 'center' && 'text-center'
                        )}
                      >
                        {formatDisplayValue(row[col.columnKey], col.format)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Bar */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
        <div>
          Showing{' '}
          <span className="font-semibold text-slate-700">
            {sortedRows.length === 0 ? 0 : startIndex + 1}
          </span>{' '}
          to{' '}
          <span className="font-semibold text-slate-700">
            {Math.min(startIndex + pageSize, sortedRows.length)}
          </span>{' '}
          of{' '}
          <span className="font-semibold text-slate-700">
            {sortedRows.length}
          </span>{' '}
          entries
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={validCurrentPage <= 1}
            aria-label="Previous page"
            className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="px-2 text-xs font-medium text-slate-700">
            Page {validCurrentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={validCurrentPage >= totalPages}
            aria-label="Next page"
            className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
