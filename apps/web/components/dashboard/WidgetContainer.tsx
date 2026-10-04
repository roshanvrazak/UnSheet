'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { QueryResult, SheetModel, WidgetSpec } from '@unsheet/contracts';
import { WidgetSpecSchema } from '@unsheet/contracts';
import { executeWidgetQuery } from '@/lib/query/executor';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';
import {
  ErrorCardWidget,
  KPIWidget,
  LineChartWidget,
  BarChartWidget,
  DonutChartWidget,
  TableWidget,
  PivotTableWidget,
} from './widgets';

export interface WidgetContainerProps {
  widget: WidgetSpec | unknown;
  sheet: SheetModel;
  activeFilters?: Record<string, unknown>;
  useDuckDB?: boolean;
}

/**
 * Inner component that validates spec, runs query, and renders specific widget.
 */
function WidgetContainerInner({
  widget,
  sheet,
  activeFilters,
  useDuckDB = false,
}: WidgetContainerProps) {
  // 1. Total renderer guarantee: Validate widget spec with contracts schema
  const validWidget = useMemo(() => {
    const parsed = WidgetSpecSchema.safeParse(widget);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error, raw: widget };
    }
    return { success: true as const, data: parsed.data };
  }, [JSON.stringify(widget)]);

  if (!validWidget.success) {
    const errorDetails = validWidget.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    const titleCandidate =
      typeof widget === 'object' && widget !== null && 'title' in widget
        ? String((widget as { title: unknown }).title)
        : 'Malformed Widget Spec';
    const idCandidate =
      typeof widget === 'object' && widget !== null && 'id' in widget
        ? String((widget as { id: unknown }).id)
        : undefined;

    return (
      <ErrorCardWidget
        title={titleCandidate}
        error={`Invalid widget specification: ${errorDetails}`}
        widgetId={idCandidate}
      />
    );
  }

  const widgetSpec = validWidget.data;

  // 2. Query state
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setQueryError(null);

    executeWidgetQuery(sheet, widgetSpec, { activeFilters, useDuckDB })
      .then((res) => {
        if (!isCancelled) {
          setQueryResult(res);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setQueryError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [widgetSpec, sheet, activeFilters, useDuckDB]);

  // 3. Render Query Error
  if (queryError) {
    return (
      <ErrorCardWidget
        title={widgetSpec.title}
        error={queryError}
        widgetId={widgetSpec.id}
      />
    );
  }

  // 4. Loading Skeleton
  if (isLoading && !queryResult) {
    return (
      <div
        role="status"
        aria-label={`Loading ${widgetSpec.title}`}
        className="flex flex-col justify-between h-full min-h-[160px] rounded-xl border border-slate-200/80 bg-white p-5 animate-pulse"
      >
        <div>
          <div className="h-4 w-32 bg-slate-200 rounded mb-3"></div>
          <div className="h-8 w-24 bg-slate-200 rounded"></div>
        </div>
        <div className="h-3 w-48 bg-slate-100 rounded mt-4"></div>
      </div>
    );
  }

  // 5. Dispatch to widget renderer
  switch (widgetSpec.type) {
    case 'kpi':
      return <KPIWidget spec={widgetSpec} queryResult={queryResult!} />;
    case 'line':
      return <LineChartWidget spec={widgetSpec} queryResult={queryResult!} />;
    case 'bar':
      return <BarChartWidget spec={widgetSpec} queryResult={queryResult!} />;
    case 'donut':
      return <DonutChartWidget spec={widgetSpec} queryResult={queryResult!} />;
    case 'table':
      return <TableWidget spec={widgetSpec} queryResult={queryResult!} />;
    case 'pivot':
      return <PivotTableWidget spec={widgetSpec} queryResult={queryResult!} />;
    default: {
      const exhaustiveCheck: never = widgetSpec;
      return (
        <ErrorCardWidget
          title="Unsupported Widget"
          error={`Unsupported widget type: ${(exhaustiveCheck as { type: string }).type}`}
        />
      );
    }
  }
}

/**
 * Top-level widget wrapper with ErrorBoundary.
 */
export function WidgetContainer(props: WidgetContainerProps) {
  const widgetId =
    typeof props.widget === 'object' && props.widget !== null && 'id' in props.widget
      ? String((props.widget as { id: unknown }).id)
      : undefined;
  const widgetTitle =
    typeof props.widget === 'object' && props.widget !== null && 'title' in props.widget
      ? String((props.widget as { title: unknown }).title)
      : undefined;

  return (
    <WidgetErrorBoundary widgetId={widgetId} widgetTitle={widgetTitle}>
      <WidgetContainerInner {...props} />
    </WidgetErrorBoundary>
  );
}
