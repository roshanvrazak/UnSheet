import { describe, it, expect } from 'vitest';
import type {
  BarChartWidgetSpec,
  DonutChartWidgetSpec,
  KPIWidgetSpec,
  LineChartWidgetSpec,
  PivotTableWidgetSpec,
  SheetModel,
  SheetProfile,
  TableWidgetSpec,
} from '@unsheet/contracts';
import { QueryPlanSchema } from '@unsheet/contracts';
import { buildWidgetQueryPlan, getSheetTableName } from '../../src/query/planner.js';

const mockSheetModel: SheetModel = {
  id: 'sheet_sales_1',
  name: 'Monthly_Sales',
  headers: {
    detectedRowIndex: 0,
    confidence: 1,
    originalHeaders: ['Region', 'Product', 'Revenue', 'Units', 'OrderDate'],
    sanitizedKeys: ['region', 'product', 'revenue', 'units', 'order_date'],
  },
  columns: [
    { key: 'region', originalName: 'Region', columnIndex: 0 },
    { key: 'product', originalName: 'Product', columnIndex: 1 },
    { key: 'revenue', originalName: 'Revenue', columnIndex: 2 },
    { key: 'units', originalName: 'Units', columnIndex: 3 },
    { key: 'order_date', originalName: 'OrderDate', columnIndex: 4 },
  ],
  rows: [
    { region: 'North', product: 'Alpha', revenue: 100, units: 10, order_date: '2023-01-01' },
    { region: 'South', product: 'Beta', revenue: 200, units: 20, order_date: '2023-01-02' },
  ],
  rowCount: 2,
  columnCount: 5,
};

const mockSheetProfile: SheetProfile = {
  sheetId: 'sheet_profile_1',
  sheetName: 'Customers',
  rowCount: 100,
  columnProfiles: [
    {
      columnKey: 'customer_id',
      originalName: 'Customer ID',
      inferredType: 'id',
      semanticRole: 'identifier',
      nullable: false,
      nullCount: 0,
      totalCount: 100,
      distinctCount: 100,
      uniquenessRatio: 1.0,
      sampleValues: ['C1', 'C2'],
    },
    {
      columnKey: 'segment',
      originalName: 'Segment',
      inferredType: 'category',
      semanticRole: 'dimension',
      nullable: false,
      nullCount: 0,
      totalCount: 100,
      distinctCount: 3,
      uniquenessRatio: 0.03,
      sampleValues: ['Enterprise', 'SMB'],
    },
    {
      columnKey: 'spend',
      originalName: 'Spend',
      inferredType: 'currency',
      semanticRole: 'measure',
      nullable: false,
      nullCount: 0,
      totalCount: 100,
      distinctCount: 80,
      uniquenessRatio: 0.8,
      sampleValues: ['1000', '2500'],
    },
    {
      columnKey: 'signup_date',
      originalName: 'Signup Date',
      inferredType: 'date',
      semanticRole: 'time',
      nullable: false,
      nullCount: 0,
      totalCount: 100,
      distinctCount: 50,
      uniquenessRatio: 0.5,
      sampleValues: ['2023-01-01'],
    },
  ],
  recommendedDimensions: ['segment'],
  recommendedMeasures: ['spend'],
  recommendedTimeColumn: 'signup_date',
};

describe('Query Planner (buildWidgetQueryPlan)', () => {
  describe('Table name resolution', () => {
    it('extracts table name from SheetModel and SheetProfile', () => {
      expect(getSheetTableName(mockSheetModel)).toBe('Monthly_Sales');
      expect(getSheetTableName(mockSheetProfile)).toBe('Customers');

      const nonSafeSheet: SheetModel = {
        ...mockSheetModel,
        name: 'My Special Sheet (2024)!',
      };
      const tableName = getSheetTableName(nonSafeSheet);
      expect(tableName).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
    });
  });

  describe('KPI Widget Plan', () => {
    const kpiWidget: KPIWidgetSpec = {
      id: 'kpi_total_revenue',
      type: 'kpi',
      title: 'Total Revenue',
      grid: { x: 0, y: 0, w: 4, h: 2 },
      measure: 'revenue',
      aggregation: 'sum',
      filterBindings: ['filter_region'],
    };

    it('generates a valid QueryPlan with single aggregation and limit 1', () => {
      const plan = buildWidgetQueryPlan(mockSheetModel, kpiWidget);
      expect(plan.table).toBe('Monthly_Sales');
      expect(plan.aggregations).toEqual([
        {
          columnKey: 'revenue',
          function: 'sum',
          alias: 'revenue',
        },
      ]);
      expect(plan.limit).toBe(1);
      expect(plan.dimensions).toBeUndefined();
      expect(() => QueryPlanSchema.parse(plan)).not.toThrow();
    });

    it('merges bound global filters and ignores unbound filters', () => {
      const plan = buildWidgetQueryPlan(mockSheetModel, kpiWidget, {
        filter_region: 'North',
        filter_product: 'Alpha', // unbound
      });

      expect(plan.filters).toBeDefined();
      expect(plan.filters?.length).toBe(1);
      expect(plan.filters?.[0]).toEqual({
        columnKey: 'region',
        operator: 'eq',
        value: 'North',
      });
      expect(() => QueryPlanSchema.parse(plan)).not.toThrow();
    });
  });

  describe('Line Chart Widget Plan', () => {
    const lineWidget: LineChartWidgetSpec = {
      id: 'line_trend',
      type: 'line',
      title: 'Revenue Trend',
      grid: { x: 0, y: 0, w: 8, h: 4 },
      timeDimension: 'order_date',
      measures: ['revenue', 'units'],
      aggregation: 'sum',
      timeGranularity: 'month',
    };

    it('generates valid QueryPlan with time dimension, multiple measure aggregations, and asc order', () => {
      const plan = buildWidgetQueryPlan(mockSheetModel, lineWidget);
      expect(plan.table).toBe('Monthly_Sales');
      expect(plan.dimensions).toEqual(['order_date']);
      expect(plan.aggregations).toEqual([
        { columnKey: 'revenue', function: 'sum', alias: 'revenue' },
        { columnKey: 'units', function: 'sum', alias: 'units' },
      ]);
      expect(plan.orderBy).toEqual([{ columnKey: 'order_date', direction: 'asc' }]);
      expect(() => QueryPlanSchema.parse(plan)).not.toThrow();
    });
  });

  describe('Bar Chart Widget Plan', () => {
    const barWidget: BarChartWidgetSpec = {
      id: 'bar_by_region',
      type: 'bar',
      title: 'Revenue by Region',
      grid: { x: 0, y: 0, w: 6, h: 4 },
      dimension: 'region',
      measures: ['revenue'],
      aggregation: 'sum',
      limit: 15,
      sort: { by: 'value', direction: 'desc' },
    };

    it('generates valid QueryPlan with dimension, aggregation, and value sort', () => {
      const plan = buildWidgetQueryPlan(mockSheetModel, barWidget);
      expect(plan.dimensions).toEqual(['region']);
      expect(plan.aggregations).toEqual([
        { columnKey: 'revenue', function: 'sum', alias: 'revenue' },
      ]);
      expect(plan.orderBy).toEqual([{ columnKey: 'revenue', direction: 'desc' }]);
      expect(plan.limit).toBe(15);
      expect(() => QueryPlanSchema.parse(plan)).not.toThrow();
    });

    it('defaults order to measure desc when sort config is omitted', () => {
      const widgetWithoutSort: BarChartWidgetSpec = {
        ...barWidget,
        sort: undefined,
      };
      const plan = buildWidgetQueryPlan(mockSheetModel, widgetWithoutSort);
      expect(plan.orderBy).toEqual([{ columnKey: 'revenue', direction: 'desc' }]);
      expect(() => QueryPlanSchema.parse(plan)).not.toThrow();
    });

    it('handles sort by label', () => {
      const labelSortWidget: BarChartWidgetSpec = {
        ...barWidget,
        sort: { by: 'label', direction: 'asc' },
      };
      const plan = buildWidgetQueryPlan(mockSheetModel, labelSortWidget);
      expect(plan.orderBy).toEqual([{ columnKey: 'region', direction: 'asc' }]);
    });
  });

  describe('Donut Chart Widget Plan', () => {
    const donutWidget: DonutChartWidgetSpec = {
      id: 'donut_by_product',
      type: 'donut',
      title: 'Product Breakdown',
      grid: { x: 0, y: 0, w: 4, h: 4 },
      dimension: 'product',
      measure: 'revenue',
      aggregation: 'sum',
      maxSlices: 8,
    };

    it('generates valid QueryPlan with dimension, measure agg, desc order, and maxSlices limit', () => {
      const plan = buildWidgetQueryPlan(mockSheetModel, donutWidget);
      expect(plan.dimensions).toEqual(['product']);
      expect(plan.aggregations).toEqual([
        { columnKey: 'revenue', function: 'sum', alias: 'revenue' },
      ]);
      expect(plan.orderBy).toEqual([{ columnKey: 'revenue', direction: 'desc' }]);
      expect(plan.limit).toBe(8);
      expect(() => QueryPlanSchema.parse(plan)).not.toThrow();
    });
  });

  describe('Table Widget Plan', () => {
    const tableWidget: TableWidgetSpec = {
      id: 'table_view',
      type: 'table',
      title: 'Sales Table',
      grid: { x: 0, y: 0, w: 12, h: 6 },
      columns: [
        { columnKey: 'region', header: 'Region' },
        { columnKey: 'revenue', header: 'Revenue' },
      ],
      pageSize: 25,
      defaultSort: { columnKey: 'revenue', direction: 'desc' },
    };

    it('generates valid QueryPlan with select columns, default sort, and page size limit', () => {
      const plan = buildWidgetQueryPlan(mockSheetModel, tableWidget);
      expect(plan.select).toEqual(['region', 'revenue']);
      expect(plan.orderBy).toEqual([{ columnKey: 'revenue', direction: 'desc' }]);
      expect(plan.limit).toBe(25);
      expect(plan.offset).toBe(0);
      expect(() => QueryPlanSchema.parse(plan)).not.toThrow();
    });
  });

  describe('Pivot Table Widget Plan', () => {
    const pivotWidget: PivotTableWidgetSpec = {
      id: 'pivot_matrix',
      type: 'pivot',
      title: 'Region x Product Matrix',
      grid: { x: 0, y: 0, w: 12, h: 6 },
      rowDimensions: ['region'],
      colDimensions: ['product'],
      measures: [
        { columnKey: 'revenue', aggregation: 'sum', label: 'Total Revenue' },
        { columnKey: 'units', aggregation: 'avg', label: 'Avg Units' },
      ],
    };

    it('generates valid QueryPlan with row & col dimensions, measure aggregations, and row ordering', () => {
      const plan = buildWidgetQueryPlan(mockSheetModel, pivotWidget);
      expect(plan.dimensions).toEqual(['region', 'product']);
      expect(plan.aggregations).toEqual([
        { columnKey: 'revenue', function: 'sum', alias: 'revenue' },
        { columnKey: 'units', function: 'avg', alias: 'units' },
      ]);
      expect(plan.orderBy).toEqual([{ columnKey: 'region', direction: 'asc' }]);
      expect(() => QueryPlanSchema.parse(plan)).not.toThrow();
    });

    it('disambiguates aliases when measures share the same columnKey with different aggregations', () => {
      const multiAggPivot: PivotTableWidgetSpec = {
        ...pivotWidget,
        measures: [
          { columnKey: 'revenue', aggregation: 'sum' },
          { columnKey: 'revenue', aggregation: 'avg' },
        ],
      };
      const plan = buildWidgetQueryPlan(mockSheetModel, multiAggPivot);
      expect(plan.aggregations).toEqual([
        { columnKey: 'revenue', function: 'sum', alias: 'revenue' },
        { columnKey: 'revenue', function: 'avg', alias: 'revenue_avg' },
      ]);
    });
  });

  describe('SheetProfile Compatibility', () => {
    it('builds plan cleanly when passed SheetProfile instead of SheetModel', () => {
      const kpi: KPIWidgetSpec = {
        id: 'kpi_cust_spend',
        type: 'kpi',
        title: 'Customer Spend',
        grid: { x: 0, y: 0, w: 4, h: 2 },
        measure: 'spend',
        aggregation: 'avg',
      };

      const plan = buildWidgetQueryPlan(mockSheetProfile, kpi, {
        segment: 'Enterprise',
      });

      expect(plan.table).toBe('Customers');
      expect(plan.aggregations).toEqual([
        { columnKey: 'spend', function: 'avg', alias: 'spend' },
      ]);
      expect(plan.filters).toEqual([
        { columnKey: 'segment', operator: 'eq', value: 'Enterprise' },
      ]);
      expect(() => QueryPlanSchema.parse(plan)).not.toThrow();
    });
  });

  describe('Active Filters Handling', () => {
    const kpiWidget: KPIWidgetSpec = {
      id: 'kpi_test',
      type: 'kpi',
      title: 'KPI',
      grid: { x: 0, y: 0, w: 4, h: 2 },
      measure: 'revenue',
      aggregation: 'sum',
    };

    it('handles array values as "in" operator', () => {
      const plan = buildWidgetQueryPlan(mockSheetModel, kpiWidget, {
        region: ['North', 'South'],
      });
      expect(plan.filters).toEqual([
        { columnKey: 'region', operator: 'in', value: ['North', 'South'] },
      ]);
    });

    it('handles null values as "is_null" operator', () => {
      const plan = buildWidgetQueryPlan(mockSheetModel, kpiWidget, {
        product: null,
      });
      expect(plan.filters).toEqual([
        { columnKey: 'product', operator: 'is_null', value: null },
      ]);
    });

    it('handles explicit operator and value object', () => {
      const plan = buildWidgetQueryPlan(mockSheetModel, kpiWidget, {
        revenue: { operator: 'gte', value: 100 },
      });
      expect(plan.filters).toEqual([
        { columnKey: 'revenue', operator: 'gte', value: 100 },
      ]);
    });

    it('handles QueryFilter array directly', () => {
      const plan = buildWidgetQueryPlan(mockSheetModel, kpiWidget, [
        { columnKey: 'region', operator: 'neq', value: 'West' },
      ]);
      expect(plan.filters).toEqual([
        { columnKey: 'region', operator: 'neq', value: 'West' },
      ]);
    });
  });
});
