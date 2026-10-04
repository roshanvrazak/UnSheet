// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { DashboardSpec, SheetModel, WidgetSpec, TableWidgetSpec } from '@unsheet/contracts';
import { DashboardRenderer } from '../components/dashboard/DashboardRenderer';
import { FilterBar } from '../components/dashboard/FilterBar';
import { PivotTableWidget } from '../components/dashboard/widgets/PivotTableWidget';
import { WidgetContainer } from '../components/dashboard/WidgetContainer';

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const baseSheet: SheetModel = {
  id: 'sheet_adv_web',
  name: 'Financial_Data',
  headers: {
    detectedRowIndex: 0,
    confidence: 1.0,
    originalHeaders: ['Department', 'Category', 'Amount', 'Notes'],
    sanitizedKeys: ['department', 'category', 'amount', 'notes'],
  },
  columns: [
    { key: 'department', originalName: 'Department', columnIndex: 0 },
    { key: 'category', originalName: 'Category', columnIndex: 1 },
    { key: 'amount', originalName: 'Amount', columnIndex: 2 },
    { key: 'notes', originalName: 'Notes', columnIndex: 3 },
  ],
  rows: [
    { department: 'Engineering', category: 'Hardware', amount: 5000, notes: 'Laptops' },
    { department: 'Marketing', category: 'Software', amount: 3000, notes: 'Ads' },
    { department: 'Sales', category: 'Travel', amount: 2000, notes: 'Client visit' },
    { department: 'Engineering', category: 'Software', amount: 1500, notes: 'Cloud' },
  ],
  rowCount: 4,
  columnCount: 4,
};

describe('Adversarial Red-Team Suite: Phase 3 Dashboard Renderer & Web Components', () => {
  // =========================================================================
  // VECTOR 1: Malformed & Pathological WidgetSpecs
  // =========================================================================
  describe('Vector 1: Malformed & Pathological WidgetSpecs', () => {
    it('ADV-P3-W01: Unknown / unsupported widget type renders ErrorCardWidget without crashing dashboard or sibling widgets', async () => {
      const specWithUnsupportedWidget: DashboardSpec = {
        version: '1.0',
        id: 'dash_unknown_widget',
        title: 'Mixed Widgets Dashboard',
        sheetBinding: 'sheet_adv_web',
        layout: { columns: 12, gap: 16, padding: 16 },
        filters: [],
        widgets: [
          {
            id: 'valid_kpi',
            type: 'kpi',
            title: 'Valid Revenue KPI',
            grid: { x: 0, y: 0, w: 6, h: 4 },
            measure: 'amount',
            aggregation: 'sum',
          },
          {
            id: 'broken_radar',
            type: 'radar' as unknown as 'kpi',
            title: 'Unsupported Radar Widget',
            grid: { x: 6, y: 0, w: 6, h: 4 },
          } as unknown as WidgetSpec,
        ],
      };

      render(<DashboardRenderer spec={specWithUnsupportedWidget} sheet={baseSheet} />);

      // Sibling widget should render cleanly
      await waitFor(() => {
        expect(screen.getByText('Valid Revenue KPI')).toBeDefined();
      });

      // Malformed widget should render ErrorCardWidget with alert role
      const errorCard = screen.getByRole('alert');
      expect(errorCard).toBeDefined();
      expect(screen.getByText('Unsupported Radar Widget')).toBeDefined();
      expect(screen.getByText(/Invalid widget specification/i)).toBeDefined();
    });

    it('ADV-P3-W02: Out-of-bounds grid coordinates (w > 12, negative coordinates, NaN) are clamped safely', () => {
      const specPathologicalGrid = {
        title: 'Pathological Grid Spec',
        widgets: [
          {
            id: 'w_huge_width',
            type: 'kpi',
            title: 'Huge Width Widget',
            grid: { x: 0, y: 0, w: 999, h: 4 },
            measure: 'amount',
            aggregation: 'sum',
          },
          {
            id: 'w_neg_width',
            type: 'kpi',
            title: 'Negative Width Widget',
            grid: { x: 0, y: 0, w: -5, h: 4 },
            measure: 'amount',
            aggregation: 'sum',
          },
          {
            id: 'w_nan_width',
            type: 'kpi',
            title: 'NaN Width Widget',
            grid: { x: 0, y: 0, w: NaN, h: 4 },
            measure: 'amount',
            aggregation: 'sum',
          },
        ],
      };

      // DashboardRenderer should not crash during layout calculation
      expect(() => {
        render(<DashboardRenderer spec={specPathologicalGrid} sheet={baseSheet} />);
      }).not.toThrow();

      expect(screen.getByText('Pathological Grid Spec')).toBeDefined();
    });

    it('ADV-P3-W03: Empty widgets array or whitespace title renders top-level ErrorCardWidget fallback', () => {
      const emptyWidgetsSpec = {
        version: '1.0',
        id: 'dash_empty',
        title: 'Empty Dashboard',
        sheetBinding: 'sheet_adv_web',
        layout: { columns: 12, gap: 16, padding: 16 },
        widgets: [],
      };

      render(<DashboardRenderer spec={emptyWidgetsSpec} sheet={baseSheet} />);
      expect(screen.getByText('Malformed Dashboard Specification')).toBeDefined();
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  // =========================================================================
  // VECTOR 2: Hostile Strings & XSS
  // =========================================================================
  describe('Vector 2: Hostile Strings & XSS Payloads', () => {
    it('ADV-P3-W04: Hostile XSS payloads in widget title, description, and cell data are rendered as plain text nodes', async () => {
      const xssTitle = '<script>alert("xss-title")</script>';
      const xssDesc = '"><img src=x onerror=alert("xss-desc")>';
      const xssCell = '<iframe src="javascript:alert(1)"></iframe>';

      const xssSheet: SheetModel = {
        ...baseSheet,
        rows: [
          { department: xssCell, category: 'Hardware', amount: 100, notes: 'Safe note' },
        ],
      };

      const xssSpec: DashboardSpec = {
        version: '1.0',
        id: 'dash_xss',
        title: 'Security Audit Dashboard',
        sheetBinding: 'sheet_adv_web',
        layout: { columns: 12, gap: 16, padding: 16 },
        filters: [],
        widgets: [
          {
            id: 'table_xss',
            type: 'table',
            title: xssTitle,
            description: xssDesc,
            grid: { x: 0, y: 0, w: 12, h: 6 },
            columns: [
              { columnKey: 'department', header: '<svg/onload=alert(1)>' },
              { columnKey: 'amount', header: 'Amount' },
            ],
          },
        ],
      };

      const { container } = render(<DashboardRenderer spec={xssSpec} sheet={xssSheet} />);

      await waitFor(() => {
        expect(screen.getByText(xssTitle)).toBeDefined();
        expect(screen.getByText(xssDesc)).toBeDefined();
      });

      // Assert that NO script or iframe elements were injected into the DOM
      expect(container.querySelectorAll('script').length).toBe(0);
      expect(container.querySelectorAll('iframe').length).toBe(0);
      expect(container.querySelectorAll('img[src="x"]').length).toBe(0);
    });

    it('ADV-P3-W05: Formula injection prefixes in cell values are rendered as raw text without execution', async () => {
      const formulaSheet: SheetModel = {
        ...baseSheet,
        rows: [
          { department: "=cmd|'/C calc'!A0", category: '+HYPERLINK("http://evil.com")', amount: 100, notes: '@SUM(1+1)' },
        ],
      };

      const spec: DashboardSpec = {
        version: '1.0',
        id: 'dash_formula',
        title: 'Formula Test Dashboard',
        sheetBinding: 'sheet_adv_web',
        layout: { columns: 12, gap: 16, padding: 16 },
        filters: [],
        widgets: [
          {
            id: 'table_formula',
            type: 'table',
            title: 'Formula Display Table',
            grid: { x: 0, y: 0, w: 12, h: 6 },
            columns: [
              { columnKey: 'department', header: 'Dept' },
              { columnKey: 'category', header: 'Cat' },
              { columnKey: 'notes', header: 'Notes' },
            ],
          },
        ],
      };

      render(<DashboardRenderer spec={spec} sheet={formulaSheet} />);

      await waitFor(() => {
        expect(screen.getByText("'=cmd|'/C calc'!A0")).toBeDefined();
        expect(screen.getByText("'+HYPERLINK(\"http://evil.com\")")).toBeDefined();
        expect(screen.getByText("'@SUM(1+1)")).toBeDefined();
      });
    });
  });

  // =========================================================================
  // VECTOR 3: Prototype Pollution & Property Collisions in Widgets
  // =========================================================================
  describe('Vector 3: Prototype Collisions in Pivot Table Widget', () => {
    it('ADV-P3-W06: PivotTableWidget totals calculations collide with prototype properties (toString, valueOf), corrupting output', () => {
      // PivotTableWidget initializes cTotals = {} and does cTotals[cVal] = (cTotals[cVal] ?? 0) + val
      // If cVal is 'toString' or 'valueOf', cTotals['toString'] resolves to Function.prototype.toString!
      const hostilePivotRows = [
        { department: 'Engineering', category: 'toString', amount: 50 },
        { department: 'Sales', category: 'valueOf', amount: 75 },
      ];

      const queryResult = {
        queryId: 'q_pivot_proto',
        columns: [
          { name: 'department', type: 'string' },
          { name: 'category', type: 'string' },
          { name: 'amount', type: 'number' },
        ],
        rows: hostilePivotRows,
        rowCount: 2,
        executionTimeMs: 1,
      };

      const pivotSpec = {
        id: 'pivot_proto_test',
        type: 'pivot' as const,
        title: 'Proto Pivot',
        grid: { x: 0, y: 0, w: 12, h: 6 },
        rowDimensions: ['department'],
        colDimensions: ['category'],
        measures: [{ columnKey: 'amount', aggregation: 'sum' as const }],
        showTotals: true,
      };

      render(<PivotTableWidget spec={pivotSpec} queryResult={queryResult} />);

      // Verify that the table rendered
      expect(screen.getByText('Proto Pivot')).toBeDefined();

      // Verify that prototype collisions are prevented and totals render correctly as numbers (50 and 75)
      expect(screen.getAllByText('50').length).toBeGreaterThan(0);
      expect(screen.getAllByText('75').length).toBeGreaterThan(0);
    });

    it('ADV-P3-W07: TableWidget search and sort crash on Object.create(null) cells, isolated by WidgetErrorBoundary', async () => {
      const nullProtoRow = {
        department: Object.create(null),
        category: 'Hardware',
        amount: 100,
        notes: 'Test',
      };

      const tableSpec: TableWidgetSpec = {
        id: 'table_null_proto',
        type: 'table',
        title: 'Null Proto Table',
        grid: { x: 0, y: 0, w: 12, h: 6 },
        columns: [
          { columnKey: 'department', header: 'Dept' },
          { columnKey: 'amount', header: 'Amount' },
        ],
        searchable: true,
        sortable: true,
      };

      // Wrap in WidgetContainer which provides WidgetErrorBoundary
      render(
        <WidgetContainer
          widget={tableSpec}
          sheet={{
            ...baseSheet,
            rows: [nullProtoRow],
          }}
        />
      );

      // Widget renders or error boundary catches gracefully without unhandled exception
      await waitFor(() => {
        expect(screen.getByText('Null Proto Table')).toBeDefined();
      });
    });
  });

  // =========================================================================
  // VECTOR 4: Filter State Wipeout & Schema Drift
  // =========================================================================
  describe('Vector 4: Filter State Management & Schema Drift Fault Tolerance', () => {
    it('ADV-P3-W08: FilterBar numeric-range filter resets input state on every keystroke due to Object vs Array mismatch', () => {
      let activeFilters: Record<string, unknown> = {};
      const onFilterChange = (next: Record<string, unknown>) => {
        activeFilters = next;
      };

      const filters = [
        {
          id: 'filter_amount',
          columnKey: 'amount',
          label: 'Amount Range',
          type: 'numeric-range' as const,
        },
      ];

      const { rerender } = render(
        <FilterBar
          filters={filters}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
        />
      );

      const minInput = screen.getByLabelText('Amount Range minimum') as HTMLInputElement;

      // User types 100 into Min
      fireEvent.change(minInput, { target: { value: '100' } });

      // onFilterChange was called with { operator: 'between', value: [100, 1e12] }
      expect(activeFilters.filter_amount).toEqual({
        operator: 'between',
        value: [100, 1000000000000],
      });

      // Now FilterBar rerenders with the new activeFilters
      rerender(
        <FilterBar
          filters={filters}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
        />
      );

      // Verify that input value is preserved after rerender with { operator, value } structure
      const minInputAfterRerender = screen.getByLabelText('Amount Range minimum') as HTMLInputElement;
      expect(minInputAfterRerender.value).toBe('100');
    });

    it('ADV-P3-W09: Schema drift (widget referencing deleted column) renders isolated ErrorCardWidget while sibling renders', async () => {
      const driftSpec: DashboardSpec = {
        version: '1.0',
        id: 'dash_drift',
        title: 'Drift Test Dashboard',
        sheetBinding: 'sheet_adv_web',
        layout: { columns: 12, gap: 16, padding: 16 },
        filters: [],
        widgets: [
          {
            id: 'healthy_kpi',
            type: 'kpi',
            title: 'Healthy Revenue KPI',
            grid: { x: 0, y: 0, w: 6, h: 4 },
            measure: 'amount',
            aggregation: 'sum',
          },
          {
            id: 'drifted_kpi',
            type: 'kpi',
            title: 'Drifted Measure KPI',
            grid: { x: 6, y: 0, w: 6, h: 4 },
            measure: 'deleted_metric', // Missing from baseSheet!
            aggregation: 'sum',
          },
        ],
      };

      render(<DashboardRenderer spec={driftSpec} sheet={baseSheet} />);

      // Healthy widget renders successfully
      await waitFor(() => {
        expect(screen.getByText('Healthy Revenue KPI')).toBeDefined();
      });

      // Drifted widget renders isolated ErrorCardWidget with validation error message
      await waitFor(() => {
        expect(screen.getByText('Drifted Measure KPI')).toBeDefined();
        expect(screen.getByText(/is not allowlisted in sheet columns/i)).toBeDefined();
      });
    });

    it('ADV-P3-W10: Empty sheet (0 rows) renders cleanly across visual chart widgets without uncaught exceptions', async () => {
      const emptySheet: SheetModel = {
        ...baseSheet,
        rows: [],
        rowCount: 0,
      };

      const emptyDashboardSpec: DashboardSpec = {
        version: '1.0',
        id: 'dash_empty_data',
        title: 'Empty Sheet Dashboard',
        sheetBinding: 'sheet_adv_web',
        layout: { columns: 12, gap: 16, padding: 16 },
        filters: [],
        widgets: [
          {
            id: 'empty_kpi',
            type: 'kpi',
            title: 'Empty KPI',
            grid: { x: 0, y: 0, w: 6, h: 4 },
            measure: 'amount',
            aggregation: 'sum',
          },
          {
            id: 'empty_table',
            type: 'table',
            title: 'Empty Table',
            grid: { x: 6, y: 0, w: 6, h: 4 },
            columns: [
              { columnKey: 'department', header: 'Dept' },
              { columnKey: 'amount', header: 'Amount' },
            ],
          },
        ],
      };

      render(<DashboardRenderer spec={emptyDashboardSpec} sheet={emptySheet} />);

      await waitFor(() => {
        expect(screen.getByText('Empty KPI')).toBeDefined();
        expect(screen.getByText('Empty Table')).toBeDefined();
        expect(screen.getByText('No matching records found')).toBeDefined();
      });
    });
  });
});
