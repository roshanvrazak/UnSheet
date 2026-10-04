'use client';

import React, { useState } from 'react';
import type { DashboardSpec, SheetModel, FilterSpec } from '@unsheet/contracts';
import { DashboardSpecSchema } from '@unsheet/contracts';
import { FilterBar } from './FilterBar';
import { WidgetContainer } from './WidgetContainer';
import { ErrorCardWidget } from './widgets/ErrorCardWidget';
import { cn } from '@/lib/utils';

export interface DashboardRendererProps {
  spec: DashboardSpec | unknown;
  sheet: SheetModel;
  initialFilters?: Record<string, unknown>;
  onFilterChange?: (filters: Record<string, unknown>) => void;
  useDuckDB?: boolean;
  className?: string;
}

/**
 * Mapping of 12-column desktop grid widths to Tailwind classes.
 * Mobile devices safely default to full-width (col-span-12) for responsive usability.
 */
const COL_SPAN_CLASSES: Record<number, string> = {
  1: 'col-span-12 md:col-span-1',
  2: 'col-span-12 md:col-span-2',
  3: 'col-span-12 md:col-span-3',
  4: 'col-span-12 md:col-span-4',
  5: 'col-span-12 md:col-span-5',
  6: 'col-span-12 md:col-span-6',
  7: 'col-span-12 md:col-span-7',
  8: 'col-span-12 md:col-span-8',
  9: 'col-span-12 md:col-span-9',
  10: 'col-span-12 md:col-span-10',
  11: 'col-span-12 md:col-span-11',
  12: 'col-span-12 md:col-span-12',
};

/**
 * Total Dashboard Renderer.
 * Renders a full DashboardSpec across a responsive 12-column CSS Grid.
 * Total renderer guarantee: Wraps every widget in try-catch/Error Boundary. If any widget fails or is malformed,
 * ErrorCardWidget is rendered without breaking the page or sibling widgets.
 * Manages active filter state and propagates changes reactively to widgets.
 */
export function DashboardRenderer({
  spec,
  sheet,
  initialFilters = {},
  onFilterChange,
  useDuckDB = false,
  className,
}: DashboardRendererProps) {
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(initialFilters);

  // 1. Total renderer guarantee: Validate top-level spec or fall back gracefully
  let validSpec: {
    title: string;
    description?: string | undefined;
    filters?: FilterSpec[] | undefined;
    widgets: unknown[];
    layout?: { columns: number; gap: number; padding: number } | undefined;
  };

  const parsedSpec = DashboardSpecSchema.safeParse(spec);
  if (parsedSpec.success) {
    validSpec = parsedSpec.data;
  } else if (
    typeof spec === 'object' &&
    spec !== null &&
    Array.isArray((spec as { widgets?: unknown }).widgets) &&
    (spec as { widgets: unknown[] }).widgets.length > 0 &&
    typeof (spec as { title?: unknown }).title === 'string' &&
    (spec as { title: string }).title.trim() !== ''
  ) {
    // If top-level has valid title and widgets array, allow individual widgets to be validated per-container!
    const rawSpec = spec as Record<string, unknown>;
    validSpec = {
      title: rawSpec.title as string,
      description: typeof rawSpec.description === 'string' ? rawSpec.description : '',
      filters: Array.isArray(rawSpec.filters) ? (rawSpec.filters as FilterSpec[]) : [],
      widgets: rawSpec.widgets as unknown[],
      layout:
        typeof rawSpec.layout === 'object' && rawSpec.layout !== null
          ? (rawSpec.layout as { columns: number; gap: number; padding: number })
          : { columns: 12, gap: 16, padding: 16 },
    };
  } else {
    const errorIssues = parsedSpec.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');

    return (
      <div className="p-6">
        <ErrorCardWidget
          title="Malformed Dashboard Specification"
          error={`Dashboard specification failed contract validation: ${errorIssues}`}
        />
      </div>
    );
  }

  const handleFilterUpdate = (newFilters: Record<string, unknown>) => {
    setActiveFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  const gapPx = validSpec.layout?.gap ?? 16;
  const paddingPx = validSpec.layout?.padding ?? 16;

  return (
    <div
      className={cn('w-full flex flex-col space-y-6', className)}
      style={{ padding: `${paddingPx}px` }}
    >
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {validSpec.title}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{validSpec.description}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Sheet: <strong className="text-slate-700">{sheet.name}</strong></span>
          <span>•</span>
          <span>{sheet.rowCount.toLocaleString()} rows</span>
        </div>
      </div>

      {/* Global Filter Bar */}
      {validSpec.filters && validSpec.filters.length > 0 && (
        <FilterBar
          filters={validSpec.filters}
          activeFilters={activeFilters}
          onFilterChange={handleFilterUpdate}
        />
      )}

      {/* 12-Column Responsive CSS Grid */}
      <div
        className="grid grid-cols-12 w-full"
        style={{ gap: `${gapPx}px` }}
      >
        {validSpec.widgets.map((widget: unknown, index: number) => {
          const wObj =
            typeof widget === 'object' && widget !== null
              ? (widget as { id?: unknown; grid?: { w?: unknown } })
              : {};
          const rawW = typeof wObj.grid?.w === 'number' ? wObj.grid.w : 12;
          const width = Math.min(12, Math.max(1, rawW));
          const colClass = COL_SPAN_CLASSES[width] || 'col-span-12';
          const widgetKey =
            typeof wObj.id === 'string' ? wObj.id : `widget-${index}`;

          return (
            <div
              key={widgetKey}
              className={cn(colClass, 'flex flex-col')}
            >
              <WidgetContainer
                widget={widget}
                sheet={sheet}
                activeFilters={activeFilters}
                useDuckDB={useDuckDB}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
