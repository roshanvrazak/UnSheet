'use client';

import React, { useState, useId } from 'react';
import { Table, EyeOff } from 'lucide-react';
import type { DisplayFormat } from '@unsheet/contracts';
import { formatDisplayValue } from '@/lib/utils';

export interface AccessibleTableColumn {
  key: string;
  label: string;
  format?: DisplayFormat;
}

export interface AccessibleDataTableProps {
  title: string;
  columns: AccessibleTableColumn[];
  rows: Array<Record<string, unknown>>;
  caption?: string;
  defaultOpen?: boolean;
}

/**
 * Standard accessible data table companion for visual chart widgets.
 * Renders standard semantic HTML <table> with <caption>, <th scope="col">, and <td> cells.
 * Zero dangerouslySetInnerHTML: all values rendered as sanitized React JSX text nodes.
 * Conforms strictly to WCAG AA, Section 508, and axe-core accessibility standards.
 */
export function AccessibleDataTable({
  title,
  columns,
  rows,
  caption,
  defaultOpen = false,
}: AccessibleDataTableProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const tableId = useId();

  if (rows.length === 0 || columns.length === 0) {
    return null;
  }

  const tableCaption =
    caption || `Data table representation of chart: ${title}`;

  return (
    <div className="mt-3 border-t border-slate-100 pt-2.5">
      {/* Toggle button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-controls={`accessible-table-${tableId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1.5 py-1 transition-colors"
        >
          {isOpen ? (
            <>
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Hide accessible data table</span>
            </>
          ) : (
            <>
              <Table className="h-3.5 w-3.5" aria-hidden="true" />
              <span>View as accessible table</span>
            </>
          )}
        </button>
        <span className="text-[11px] text-slate-600">
          {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        </span>
      </div>

      {/* Screen-reader-only table (always accessible for assistive technologies) */}
      {!isOpen && (
        <div className="sr-only">
          <table aria-label={tableCaption}>
            <caption>{tableCaption}</caption>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} scope="col">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {formatDisplayValue(row[col.key], col.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Visually rendered accessible table when toggled on */}
      {isOpen && (
        <div
          id={`accessible-table-${tableId}`}
          tabIndex={0}
          role="region"
          aria-label={tableCaption}
          className="mt-2.5 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <table className="w-full text-left text-xs text-slate-700">
            <caption className="sr-only">{tableCaption}</caption>
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className="px-3 py-2 text-left whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-1.5 whitespace-nowrap text-slate-600"
                    >
                      {formatDisplayValue(row[col.key], col.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
