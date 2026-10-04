// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type {
  KPIWidgetSpec,
  LineChartWidgetSpec,
  BarChartWidgetSpec,
  DonutChartWidgetSpec,
  TableWidgetSpec,
  PivotTableWidgetSpec,
  QueryResult,
} from '@unsheet/contracts';
import {
  ErrorCardWidget,
  KPIWidget,
  LineChartWidget,
  BarChartWidget,
  DonutChartWidget,
  TableWidget,
  PivotTableWidget,
} from '../components/dashboard/widgets';

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe('Widget Registry & Individual Widget Tests', () => {
  describe('ErrorCardWidget', () => {
    it('renders widget title, sanitized error message, and role="alert"', () => {
      render(
        <ErrorCardWidget
          title="Revenue Metric Error"
          error="Failed to compute sum for measure: gross_revenue"
          widgetId="widget_kpi_1"
        />
      );

      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText('Revenue Metric Error')).toBeDefined();
      expect(
        screen.getByText('Failed to compute sum for measure: gross_revenue')
      ).toBeDefined();
      expect(screen.getByText('ID: widget_kpi_1')).toBeDefined();
    });

    it('sanitizes file paths from error message for security', () => {
      render(
        <ErrorCardWidget
          title="Security Test Error"
          error="Error in /home/user/secret/project/data.xlsx: invalid header"
        />
      );

      expect(screen.queryByText(/\/home\/user\/secret/)).toBeNull();
      expect(screen.getByText(/\[path\]: invalid header/)).toBeDefined();
    });
  });

  describe('KPIWidget', () => {
    const kpiSpec: KPIWidgetSpec = {
      id: 'kpi_total_revenue',
      type: 'kpi',
      title: 'Total Revenue',
      description: 'SUM of revenue across all regions',
      grid: { x: 0, y: 0, w: 4, h: 2 },
      measure: 'revenue',
      aggregation: 'sum',
      format: { prefix: '$', precision: 2 },
      comparison: {
        previousValue: 10000,
        changeType: 'percent',
        periodLabel: 'vs last month',
      },
    };

    const queryResult: QueryResult = {
      queryId: 'q_kpi_1',
      columns: [{ name: 'revenue', type: 'number' }],
      rows: [{ revenue: 12500 }],
      rowCount: 1,
      executionTimeMs: 0.5,
    };

    it('renders formatted primary metric and comparison change badge', () => {
      render(<KPIWidget spec={kpiSpec} queryResult={queryResult} />);

      expect(screen.getByText(/Total Revenue/i)).toBeDefined();
      expect(screen.getByText('$12,500.00')).toBeDefined();
      expect(screen.getByText('+25.0%')).toBeDefined();
      expect(screen.getByText('vs last month')).toBeDefined();
      expect(screen.getByText('SUM of revenue across all regions')).toBeDefined();
    });

    it('handles negative comparison changes with down trend indicator', () => {
      const negativeResult: QueryResult = {
        queryId: 'q_kpi_2',
        columns: [{ name: 'revenue', type: 'number' }],
        rows: [{ revenue: 8000 }],
        rowCount: 1,
        executionTimeMs: 0.4,
      };

      render(<KPIWidget spec={kpiSpec} queryResult={negativeResult} />);
      expect(screen.getByText('-20.0%')).toBeDefined();
    });
  });

  describe('LineChartWidget', () => {
    const lineSpec: LineChartWidgetSpec = {
      id: 'line_trend',
      type: 'line',
      title: 'Revenue Trend',
      description: 'Monthly revenue performance',
      grid: { x: 0, y: 2, w: 8, h: 5 },
      timeDimension: 'month',
      measures: ['revenue'],
      aggregation: 'sum',
    };

    const queryResult: QueryResult = {
      queryId: 'q_line_1',
      columns: [
        { name: 'month', type: 'string' },
        { name: 'revenue', type: 'number' },
      ],
      rows: [
        { month: '2024-01', revenue: 10000 },
        { month: '2024-02', revenue: 15000 },
        { month: '2024-03', revenue: 12000 },
      ],
      rowCount: 3,
      executionTimeMs: 0.6,
    };

    it('renders title, description, and includes AccessibleDataTable toggle', () => {
      render(<LineChartWidget spec={lineSpec} queryResult={queryResult} />);

      expect(screen.getByText('Revenue Trend')).toBeDefined();
      expect(screen.getByText('Monthly revenue performance')).toBeDefined();

      const toggleBtn = screen.getByRole('button', {
        name: /View as accessible table/i,
      });
      expect(toggleBtn).toBeDefined();

      // Toggle visual table
      fireEvent.click(toggleBtn);
      expect(screen.getByText('Hide accessible data table')).toBeDefined();

      const table = screen.getByRole('table');
      expect(table).toBeDefined();
      expect(screen.getAllByRole('columnheader').length).toBe(2);
    });
  });

  describe('BarChartWidget', () => {
    const barSpec: BarChartWidgetSpec = {
      id: 'bar_categories',
      type: 'bar',
      title: 'Spend by Trade',
      description: 'Capital trade budget breakdown',
      grid: { x: 0, y: 7, w: 6, h: 5 },
      dimension: 'trade',
      measures: ['spend'],
      aggregation: 'sum',
    };

    const queryResult: QueryResult = {
      queryId: 'q_bar_1',
      columns: [
        { name: 'trade', type: 'string' },
        { name: 'spend', type: 'number' },
      ],
      rows: [
        { trade: 'Civil', spend: 450000 },
        { trade: 'Electrical', spend: 320000 },
        { trade: 'HVAC', spend: 280000 },
      ],
      rowCount: 3,
      executionTimeMs: 0.5,
    };

    it('renders title, description, and accessible data table companion', () => {
      render(<BarChartWidget spec={barSpec} queryResult={queryResult} />);

      expect(screen.getByText('Spend by Trade')).toBeDefined();
      expect(screen.getByText('Capital trade budget breakdown')).toBeDefined();

      const toggleBtn = screen.getByRole('button', {
        name: /View as accessible table/i,
      });
      fireEvent.click(toggleBtn);

      const headers = screen.getAllByRole('columnheader');
      expect(headers.map((h) => h.textContent)).toEqual(['trade', 'spend']);
    });
  });

  describe('DonutChartWidget', () => {
    const donutSpec: DonutChartWidgetSpec = {
      id: 'donut_status',
      type: 'donut',
      title: 'Project Status Split',
      description: 'Distribution of capital projects by stage',
      grid: { x: 6, y: 7, w: 6, h: 5 },
      dimension: 'stage',
      measure: 'count',
      aggregation: 'count',
      innerRadius: 0.6,
    };

    const queryResult: QueryResult = {
      queryId: 'q_donut_1',
      columns: [
        { name: 'stage', type: 'string' },
        { name: 'count', type: 'integer' },
      ],
      rows: [
        { stage: 'Execution', count: 12 },
        { stage: 'Design', count: 8 },
        { stage: 'Testing', count: 5 },
      ],
      rowCount: 3,
      executionTimeMs: 0.4,
    };

    it('renders donut title and accessible table', () => {
      render(<DonutChartWidget spec={donutSpec} queryResult={queryResult} />);

      expect(screen.getByText('Project Status Split')).toBeDefined();

      const toggleBtn = screen.getByRole('button', {
        name: /View as accessible table/i,
      });
      fireEvent.click(toggleBtn);

      expect(screen.getByText('Execution')).toBeDefined();
      expect(screen.getByText('Design')).toBeDefined();
      expect(screen.getByText('Testing')).toBeDefined();
    });
  });

  describe('TableWidget', () => {
    const tableSpec: TableWidgetSpec = {
      id: 'table_records',
      type: 'table',
      title: 'Active Projects',
      description: 'Detailed record list',
      grid: { x: 0, y: 12, w: 12, h: 6 },
      columns: [
        { columnKey: 'code', header: 'Project Code', align: 'left' },
        { columnKey: 'name', header: 'Project Name', align: 'left' },
        {
          columnKey: 'budget',
          header: 'Approved Budget',
          align: 'right',
          format: { prefix: '$', precision: 0 },
        },
      ],
      pageSize: 2,
      sortable: true,
      searchable: true,
    };

    const queryResult: QueryResult = {
      queryId: 'q_table_1',
      columns: [
        { name: 'code', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'budget', type: 'number' },
      ],
      rows: [
        { code: 'PRJ-01', name: 'Telemetry Grid', budget: 4500000 },
        { code: 'PRJ-02', name: 'Turbine Insulation', budget: 1850000 },
        { code: 'PRJ-03', name: 'Substation Automation', budget: 3200000 },
      ],
      rowCount: 3,
      executionTimeMs: 0.8,
    };

    it('renders paginated rows with formatting and handles sorting and searching', () => {
      render(<TableWidget spec={tableSpec} queryResult={queryResult} />);

      // Shows page 1 (pageSize = 2)
      expect(screen.getByText('PRJ-01')).toBeDefined();
      expect(screen.getByText('PRJ-02')).toBeDefined();
      expect(screen.queryByText('PRJ-03')).toBeNull();

      // Formatted budget
      expect(screen.getByText('$4,500,000')).toBeDefined();

      // Pagination next
      const nextBtn = screen.getByRole('button', { name: /Next page/i });
      fireEvent.click(nextBtn);

      expect(screen.getByText('PRJ-03')).toBeDefined();
      expect(screen.queryByText('PRJ-01')).toBeNull();

      // Search functionality
      const searchInput = screen.getByPlaceholderText('Search table...');
      fireEvent.change(searchInput, { target: { value: 'Telemetry' } });

      expect(screen.getByText('Telemetry Grid')).toBeDefined();
      expect(screen.queryByText('Turbine Insulation')).toBeNull();
    });
  });

  describe('PivotTableWidget', () => {
    const pivotSpec: PivotTableWidgetSpec = {
      id: 'pivot_matrix',
      type: 'pivot',
      title: 'Cost Matrix',
      description: 'Spend by Region and Stage',
      grid: { x: 0, y: 18, w: 12, h: 6 },
      rowDimensions: ['region'],
      colDimensions: ['stage'],
      measures: [
        {
          columnKey: 'spend',
          aggregation: 'sum',
          label: 'Total Spend',
          format: { prefix: '$', precision: 0 },
        },
      ],
      showTotals: true,
    };

    const queryResult: QueryResult = {
      queryId: 'q_pivot_1',
      columns: [
        { name: 'region', type: 'string' },
        { name: 'stage', type: 'string' },
        { name: 'spend', type: 'number' },
      ],
      rows: [
        { region: 'North', stage: 'Execution', spend: 50000 },
        { region: 'North', stage: 'Design', spend: 20000 },
        { region: 'South', stage: 'Execution', spend: 40000 },
        { region: 'South', stage: 'Design', spend: 10000 },
      ],
      rowCount: 4,
      executionTimeMs: 0.9,
    };

    it('renders 2D cross-tabulation matrix with row and column totals', () => {
      render(<PivotTableWidget spec={pivotSpec} queryResult={queryResult} />);

      expect(screen.getByText('Cost Matrix')).toBeDefined();

      // Row headers
      expect(screen.getByText('North')).toBeDefined();
      expect(screen.getByText('South')).toBeDefined();

      // Column headers
      expect(screen.getByText('Design')).toBeDefined();
      expect(screen.getByText('Execution')).toBeDefined();

      // Check grand total ($120,000)
      expect(screen.getByText('$120,000')).toBeDefined();
    });
  });
});
