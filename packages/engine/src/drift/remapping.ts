import type { DashboardSpec, WidgetSpec } from '@unsheet/contracts';
import { DashboardSpecSchema } from '@unsheet/contracts';

/**
 * Applies column remappings (oldKey -> newKey) to a DashboardSpec.
 * Validates and returns result with DashboardSpecSchema.parse().
 */
export function applyRemappings(
  spec: DashboardSpec,
  remappings: Record<string, string>
): DashboardSpec {
  if (!remappings || Object.keys(remappings).length === 0) {
    return DashboardSpecSchema.parse(spec);
  }

  const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  const remapKey = (key?: string): string | undefined => {
    if (!key) return key;
    if (FORBIDDEN_KEYS.has(key)) return key;
    if (!Object.prototype.hasOwnProperty.call(remappings, key)) return key;
    const target = remappings[key];
    if (typeof target !== 'string' || FORBIDDEN_KEYS.has(target) || !target.trim()) {
      return key;
    }
    return target;
  };

  const remapArray = (arr?: string[]): string[] | undefined => {
    if (!arr) return arr;
    return arr.map((k) => remapKey(k)!);
  };


  // 1. Remap filters
  const filters = spec.filters.map((filter) => ({
    ...filter,
    columnKey: remapKey(filter.columnKey)!,
  }));

  // 2. Remap widgets
  const widgets: WidgetSpec[] = spec.widgets.map((widget): WidgetSpec => {
    const filterBindings = remapArray(widget.filterBindings);

    switch (widget.type) {
      case 'kpi': {
        return {
          ...widget,
          ...(filterBindings ? { filterBindings } : {}),
          measure: remapKey(widget.measure)!,
        };
      }
      case 'line': {
        return {
          ...widget,
          ...(filterBindings ? { filterBindings } : {}),
          timeDimension: remapKey(widget.timeDimension)!,
          measures: widget.measures.map((m) => remapKey(m)!),
          ...(widget.series
            ? {
                series: widget.series.map((s) => ({
                  ...s,
                  measureKey: remapKey(s.measureKey)!,
                })),
              }
            : {}),
        };
      }
      case 'bar': {
        return {
          ...widget,
          ...(filterBindings ? { filterBindings } : {}),
          dimension: remapKey(widget.dimension)!,
          measures: widget.measures.map((m) => remapKey(m)!),
        };
      }
      case 'donut': {
        return {
          ...widget,
          ...(filterBindings ? { filterBindings } : {}),
          dimension: remapKey(widget.dimension)!,
          measure: remapKey(widget.measure)!,
        };
      }
      case 'table': {
        return {
          ...widget,
          ...(filterBindings ? { filterBindings } : {}),
          columns: widget.columns.map((col) => ({
            ...col,
            columnKey: remapKey(col.columnKey)!,
          })),
          ...(widget.defaultSort
            ? {
                defaultSort: {
                  ...widget.defaultSort,
                  columnKey: remapKey(widget.defaultSort.columnKey)!,
                },
              }
            : {}),
        };
      }
      case 'pivot': {
        return {
          ...widget,
          ...(filterBindings ? { filterBindings } : {}),
          rowDimensions: widget.rowDimensions.map((d) => remapKey(d)!),
          ...(widget.colDimensions
            ? { colDimensions: widget.colDimensions.map((d) => remapKey(d)!) }
            : {}),
          measures: widget.measures.map((m) => ({
            ...m,
            columnKey: remapKey(m.columnKey)!,
          })),
        };
      }
      default:
        return widget as WidgetSpec;
    }
  });

  const updatedSpec: DashboardSpec = {
    ...spec,
    filters,
    widgets,
  };

  return DashboardSpecSchema.parse(updatedSpec);
}
