import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyRemappings } from '../../src/drift/remapping.js';
import type { DashboardSpec, KPIWidgetSpec, LineChartWidgetSpec, BarChartWidgetSpec, DonutChartWidgetSpec, TableWidgetSpec, PivotTableWidgetSpec } from '@unsheet/contracts';

describe('applyRemappings', () => {
  const baseSpec: DashboardSpec = {
    version: '1.0',
    id: 'dash_1',
    title: 'Test Dashboard',
    description: 'A test dashboard spec',
    sheetBinding: 'sheet_1',
    layout: { columns: 12, gap: 16, padding: 16 },
    filters: [
      {
        id: 'filt_1',
        columnKey: 'region',
        label: 'Region',
        type: 'select',
      },
    ],
    widgets: [
      {
        id: 'w_kpi',
        type: 'kpi',
        title: 'Total Sales',
        description: 'Sales KPI',
        grid: { x: 0, y: 0, w: 4, h: 2 },
        measure: 'sales',
        aggregation: 'sum',
        filterBindings: ['filt_1'],
      },
      {
        id: 'w_line',
        type: 'line',
        title: 'Sales Trend',
        description: 'Trend over time',
        grid: { x: 4, y: 0, w: 8, h: 4 },
        timeDimension: 'order_date',
        measures: ['sales', 'profit'],
        aggregation: 'sum',
        series: [{ measureKey: 'sales', label: 'Sales' }],
      },
      {
        id: 'w_bar',
        type: 'bar',
        title: 'Sales by Category',
        description: 'Bar chart',
        grid: { x: 0, y: 4, w: 6, h: 4 },
        dimension: 'category',
        measures: ['sales'],
        aggregation: 'sum',
      },
      {
        id: 'w_donut',
        type: 'donut',
        title: 'Sales Share',
        description: 'Donut chart',
        grid: { x: 6, y: 4, w: 6, h: 4 },
        dimension: 'category',
        measure: 'sales',
        aggregation: 'sum',
      },
      {
        id: 'w_table',
        type: 'table',
        title: 'Details',
        description: 'Table view',
        grid: { x: 0, y: 8, w: 12, h: 4 },
        columns: [
          { columnKey: 'order_id', header: 'Order ID' },
          { columnKey: 'sales', header: 'Sales' },
        ],
        defaultSort: { columnKey: 'sales', direction: 'desc' },
      },
      {
        id: 'w_pivot',
        type: 'pivot',
        title: 'Pivot Analysis',
        description: 'Pivot table',
        grid: { x: 0, y: 12, w: 12, h: 6 },
        rowDimensions: ['region'],
        colDimensions: ['category'],
        measures: [{ columnKey: 'sales', aggregation: 'sum' }],
      },
    ],
  };

  it('replaces column keys across all 6 widget types and filters', () => {
    const remappings = {
      region: 'geo_region',
      sales: 'total_revenue',
      profit: 'net_profit',
      order_date: 'invoice_date',
      category: 'product_category',
      order_id: 'transaction_id',
    };

    const updated = applyRemappings(baseSpec, remappings);

    expect(updated.filters[0]?.columnKey).toBe('geo_region');

    const kpi = updated.widgets.find((w) => w.type === 'kpi') as KPIWidgetSpec;
    expect(kpi?.measure).toBe('total_revenue');

    const line = updated.widgets.find((w) => w.type === 'line') as LineChartWidgetSpec;
    expect(line?.timeDimension).toBe('invoice_date');
    expect(line?.measures).toEqual(['total_revenue', 'net_profit']);
    expect(line?.series?.[0]?.measureKey).toBe('total_revenue');

    const bar = updated.widgets.find((w) => w.type === 'bar') as BarChartWidgetSpec;
    expect(bar?.dimension).toBe('product_category');
    expect(bar?.measures).toEqual(['total_revenue']);

    const donut = updated.widgets.find((w) => w.type === 'donut') as DonutChartWidgetSpec;
    expect(donut?.dimension).toBe('product_category');
    expect(donut?.measure).toBe('total_revenue');

    const table = updated.widgets.find((w) => w.type === 'table') as TableWidgetSpec;
    expect(table?.columns[0]?.columnKey).toBe('transaction_id');
    expect(table?.columns[1]?.columnKey).toBe('total_revenue');
    expect(table?.defaultSort?.columnKey).toBe('total_revenue');

    const pivot = updated.widgets.find((w) => w.type === 'pivot') as PivotTableWidgetSpec;
    expect(pivot?.rowDimensions).toEqual(['geo_region']);
    expect(pivot?.colDimensions).toEqual(['product_category']);
    expect(pivot?.measures[0]?.columnKey).toBe('total_revenue');
  });

  it('retains valid IDs and layouts', () => {
    const remappings = { sales: 'revenue' };
    const updated = applyRemappings(baseSpec, remappings);

    expect(updated.id).toBe(baseSpec.id);
    expect(updated.title).toBe(baseSpec.title);
    expect(updated.layout).toBeDefined();
    expect(updated.widgets[0]?.id).toBe(baseSpec.widgets[0]?.id);
    expect(updated.widgets[0]?.grid).toEqual(baseSpec.widgets[0]?.grid);
  });

  it('property test with fast-check for remapping stability', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ minLength: 1, maxLength: 10 })),
        (remappings) => {
          const result = applyRemappings(baseSpec, remappings);
          expect(result).toBeDefined();
          expect(result.version).toBe('1.0');
        }
      )
    );
  });
});
