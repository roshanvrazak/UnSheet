// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { DashboardSpec, SheetModel, WidgetSpec } from '@unsheet/contracts';
import { DashboardRenderer } from '../components/dashboard/DashboardRenderer';
import { FilterBar } from '../components/dashboard/FilterBar';
import { AccessibleDataTable } from '../components/dashboard/AccessibleDataTable';

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const mockSheet: SheetModel = {
  id: 'sheet_sales_q3',
  name: 'Q3_Sales',
  headers: {
    detectedRowIndex: 0,
    confidence: 1.0,
    originalHeaders: ['Region', 'Product', 'Revenue'],
    sanitizedKeys: ['region', 'product', 'revenue'],
  },
  columns: [
    { key: 'region', originalName: 'Region', columnIndex: 0 },
    { key: 'product', originalName: 'Product', columnIndex: 1 },
    { key: 'revenue', originalName: 'Revenue', columnIndex: 2 },
  ],
  rows: [
    { region: 'North', product: 'Software', revenue: 50000 },
    { region: 'South', product: 'Hardware', revenue: 30000 },
    { region: 'North', product: 'Hardware', revenue: 20000 },
    { region: 'West', product: 'Software', revenue: 40000 },
  ],
  rowCount: 4,
  columnCount: 3,
};

const mockValidSpec: DashboardSpec = {
  version: '1.0',
  id: 'dash_sales_overview',
  title: 'Executive Sales Dashboard',
  description: 'Regional performance and product breakdown',
  sheetBinding: 'sheet_sales_q3',
  layout: { columns: 12, gap: 16, padding: 16 },
  filters: [
    {
      id: 'filter_region',
      columnKey: 'region',
      label: 'Region',
      type: 'select',
      options: [
        { label: 'North', value: 'North' },
        { label: 'South', value: 'South' },
        { label: 'West', value: 'West' },
      ],
    },
  ],
  widgets: [
    {
      id: 'kpi_total_rev',
      type: 'kpi',
      title: 'Total Revenue',
      description: 'Sum of all revenues',
      grid: { x: 0, y: 0, w: 4, h: 2 },
      measure: 'revenue',
      aggregation: 'sum',
      filterBindings: ['filter_region'],
    },
    {
      id: 'bar_by_region',
      type: 'bar',
      title: 'Revenue by Region',
      description: 'Breakdown of revenue across territories',
      grid: { x: 4, y: 0, w: 8, h: 5 },
      dimension: 'region',
      measures: ['revenue'],
      aggregation: 'sum',
      filterBindings: ['filter_region'],
    },
  ],
};

describe('Total Dashboard Renderer & Fault Tolerance Guarantees', () => {
  it('renders a valid dashboard with 12-column grid and widgets', async () => {
    render(<DashboardRenderer spec={mockValidSpec} sheet={mockSheet} />);

    expect(screen.getByText('Executive Sales Dashboard')).toBeDefined();
    expect(
      screen.getByText('Regional performance and product breakdown')
    ).toBeDefined();

    // KPI widget rendered
    await waitFor(() => {
      expect(screen.getByText(/Total Revenue/i)).toBeDefined();
    });

    // Bar chart widget rendered
    expect(screen.getByText('Revenue by Region')).toBeDefined();
  });

  describe('Total Renderer Guarantee: Malformed & Invalid Widget Fault-Tolerance', () => {
    it('catches malformed widget spec (invalid type) and renders ErrorCardWidget without crashing page', async () => {
      const specWithMalformedWidget = {
        ...mockValidSpec,
        widgets: [
          ...mockValidSpec.widgets,
          // Malformed widget: missing required fields, invalid type
          {
            id: 'corrupted_widget',
            type: 'invalid_unsupported_type',
            title: 'Corrupted Chart',
            grid: { x: 0, y: 5, w: 6, h: 4 },
          } as unknown as WidgetSpec,
        ],
      };

      // Page must NOT crash
      render(
        <DashboardRenderer
          spec={specWithMalformedWidget}
          sheet={mockSheet}
        />
      );

      // The valid widgets still render successfully
      expect(screen.getByText('Executive Sales Dashboard')).toBeDefined();
      await waitFor(() => {
        expect(screen.getByText(/Total Revenue/i)).toBeDefined();
      });

      // The corrupted widget gracefully displays ErrorCardWidget
      expect(screen.getByText('Corrupted Chart')).toBeDefined();
      expect(screen.getByText(/Invalid widget specification/i)).toBeDefined();
    });

    it('catches missing grid coordinates and renders ErrorCardWidget instead of crashing', () => {
      const specWithBadGrid = {
        ...mockValidSpec,
        widgets: [
          {
            id: 'bad_grid_widget',
            type: 'kpi',
            title: 'Bad Grid Widget',
            description: 'Missing grid bounds',
            grid: { x: 15, y: 0, w: 5, h: 2 }, // Exceeds 12 columns (x + w > 12)
            measure: 'revenue',
            aggregation: 'sum',
          } as unknown as WidgetSpec,
        ],
      };

      render(<DashboardRenderer spec={specWithBadGrid} sheet={mockSheet} />);
      expect(screen.getByText('Bad Grid Widget')).toBeDefined();
      expect(screen.getByText(/Invalid widget specification/i)).toBeDefined();
    });

    it('catches malformed top-level dashboard spec and displays top-level ErrorCard', () => {
      const invalidSpec = {
        version: '999.0', // Unsupported version
        title: '', // Empty title violates schema
      };

      render(<DashboardRenderer spec={invalidSpec} sheet={mockSheet} />);
      expect(
        screen.getByText('Malformed Dashboard Specification')
      ).toBeDefined();
    });
  });

  describe('Filter State Management & Interactivity', () => {
    it('updates active filter state and triggers reactive recalculation', async () => {
      render(<DashboardRenderer spec={mockValidSpec} sheet={mockSheet} />);

      // Initial Total Revenue: 50k + 30k + 20k + 40k = 140,000
      await waitFor(() => {
        expect(screen.getByText('140,000')).toBeDefined();
      });

      // Select Region = "North"
      const regionSelect = screen.getByLabelText('Region');
      fireEvent.change(regionSelect, { target: { value: 'North' } });

      // Active filters badge should show "1 active"
      expect(screen.getByText('1 active')).toBeDefined();

      // Recalculated Total Revenue for North only: 50k + 20k = 70,000
      await waitFor(() => {
        expect(screen.getByText('70,000')).toBeDefined();
      });

      // Click "Reset filters"
      const resetBtn = screen.getByText('Reset filters');
      fireEvent.click(resetBtn);

      // Returns to 140,000
      await waitFor(() => {
        expect(screen.getByText('140,000')).toBeDefined();
      });
    });
  });

  describe('FilterBar Component', () => {
    it('renders controls for select and search filters', () => {
      let activeFilters: Record<string, unknown> = {};
      const onFilterChange = (f: Record<string, unknown>) => {
        activeFilters = f;
      };

      render(
        <FilterBar
          filters={[
            {
              id: 'f_category',
              columnKey: 'category',
              label: 'Category',
              type: 'select',
              options: [{ label: 'Tech', value: 'tech' }],
            },
            {
              id: 'f_search',
              columnKey: 'name',
              label: 'Search',
              type: 'search',
            },
          ]}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
        />
      );

      expect(screen.getByLabelText('Category')).toBeDefined();
      expect(screen.getByLabelText('Search')).toBeDefined();
    });
  });

  describe('AccessibleDataTable Standards & Security', () => {
    it('renders standard semantic table with <th scope="col"> and zero dangerouslySetInnerHTML', () => {
      const { container } = render(
        <AccessibleDataTable
          title="Audit Table"
          columns={[
            { key: 'agent', label: 'Agent Name' },
            { key: 'score', label: 'Score' },
          ]}
          rows={[
            { agent: '<b>Frontend</b>', score: 100 },
            { agent: 'Backend', score: 95 },
          ]}
          defaultOpen={true}
        />
      );

      // Verifies standard HTML table
      const table = screen.getByRole('table');
      expect(table).toBeDefined();

      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBe(2);
      expect(headers[0]?.getAttribute('scope')).toBe('col');

      // Zero dangerouslySetInnerHTML: <b> is rendered as plain text, not HTML element!
      expect(screen.getByText('<b>Frontend</b>')).toBeDefined();
      expect(container.querySelector('b')).toBeNull();
    });
  });
});
