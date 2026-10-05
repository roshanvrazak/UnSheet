// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AskYourDataDrawer } from '@/components/chat/AskYourDataDrawer';
import { SpecRefineBar } from '@/components/chat/SpecRefineBar';
import { SheetModel, SheetProfile, DashboardSpec } from '@unsheet/contracts';

const sampleSheet: SheetModel = {
  id: 'sheet_1',
  name: 'sales_data',
  headers: {
    detectedRowIndex: 0,
    confidence: 1.0,
    originalHeaders: ['Region', 'Revenue'],
    sanitizedKeys: ['region', 'revenue'],
  },
  columns: [
    { key: 'region', originalName: 'Region', columnIndex: 0 },
    { key: 'revenue', originalName: 'Revenue', columnIndex: 1 },
  ],
  rows: [],
  rowCount: 100,
  columnCount: 2,
};

const sampleProfile: SheetProfile = {
  sheetId: 'sheet_1',
  sheetName: 'sales_data',
  rowCount: 100,
  columnProfiles: [
    {
      columnKey: 'region',
      originalName: 'Region',
      inferredType: 'category',
      semanticRole: 'dimension',
      nullable: false,
      nullCount: 0,
      totalCount: 100,
      distinctCount: 3,
      uniquenessRatio: 0.03,
      sampleValues: ['North', 'South', 'East'],
    },
    {
      columnKey: 'revenue',
      originalName: 'Revenue',
      inferredType: 'currency',
      semanticRole: 'measure',
      nullable: false,
      nullCount: 0,
      totalCount: 100,
      distinctCount: 50,
      uniquenessRatio: 0.5,
      sampleValues: ['1000', '2500', '4000'],
    },
  ],
  recommendedDimensions: ['region'],
  recommendedMeasures: ['revenue'],
};

const sampleSpec: DashboardSpec = {
  version: '1.0',
  id: 'dash_1',
  title: 'Sales Dashboard',
  sheetBinding: 'sheet_1',
  layout: { columns: 12, gap: 16, padding: 16 },
  filters: [],
  widgets: [
    {
      id: 'w1',
      type: 'kpi',
      title: 'Total Revenue',
      grid: { x: 0, y: 0, w: 4, h: 4 },
      measure: 'revenue',
      aggregation: 'sum',
    },
  ],
};

describe('Phase 5 Frontend Chat & LLM UI Components (`apps/web/test/chat.test.tsx`)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Test 1: AskYourDataDrawer opens, displays sample chips, submits query, renders SQL and widget, and triggers onAddWidget', async () => {
    const handleAddWidget = vi.fn();
    const handleClose = vi.fn();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          interpretedIntent: 'Total revenue grouped by region',
          sql: 'SELECT "region", SUM("revenue") AS "total_revenue" FROM "sales_data" GROUP BY "region" LIMIT 20;',
          explanation: 'Grouped revenue by region successfully.',
          suggestedWidget: {
            id: 'bar_widget_1',
            type: 'bar',
            title: 'Revenue by Region',
            grid: { x: 0, y: 0, w: 6, h: 6 },
            dimension: 'region',
            measures: ['revenue'],
            aggregation: 'sum',
            orientation: 'vertical',
          },
        }),
      })
    );

    render(
      <AskYourDataDrawer
        isOpen={true}
        onClose={handleClose}
        sheet={sampleSheet}
        profile={sampleProfile}
        onAddWidget={handleAddWidget}
      />
    );

    expect(screen.getByText('Ask Your Data')).toBeDefined();
    expect(screen.getByText(/Total revenue by region/i)).toBeDefined();

    const chip = screen.getByText(/Total revenue by region/i);
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getByText('Total revenue grouped by region')).toBeDefined();
      expect(screen.getByText(/Generated Safe SQL Query/i)).toBeDefined();
      expect(screen.getByText(/Suggested Widget: Revenue by Region/i)).toBeDefined();
    });

    const addButton = screen.getByRole('button', { name: /Add to Dashboard/i });
    fireEvent.click(addButton);

    expect(handleAddWidget).toHaveBeenCalledTimes(1);
    expect(handleAddWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'bar_widget_1',
        type: 'bar',
      })
    );

    expect(screen.getByText('Added to dashboard!')).toBeDefined();
  });

  it('Test 2: AskYourDataDrawer handles API error and 429 rate limit gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ success: false, error: 'Rate limit exceeded' }),
      })
    );

    render(
      <AskYourDataDrawer
        isOpen={true}
        onClose={() => {}}
        sheet={sampleSheet}
        profile={sampleProfile}
        onAddWidget={() => {}}
      />
    );

    const input = screen.getByPlaceholderText('Ask a question about your data...');
    fireEvent.change(input, { target: { value: 'Average revenue' } });

    const askButton = screen.getByRole('button', { name: /Ask/i });
    fireEvent.click(askButton);

    await waitFor(() => {
      expect(screen.getByText(/Rate limit exceeded \(429\)/i)).toBeDefined();
    });
  });

  it('Test 3: SpecRefineBar submits prompt, receives updated spec, calls onSpecUpdate, and allows undo', async () => {
    const handleSpecUpdate = vi.fn();
    const updatedSpecMock: DashboardSpec = {
      ...sampleSpec,
      title: 'Refined Sales Dashboard',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          updatedSpec: updatedSpecMock,
          explanation: 'Changed dashboard title to Refined Sales Dashboard',
          appliedChanges: ['Changed title'],
        }),
      })
    );

    render(
      <SpecRefineBar
        currentSpec={sampleSpec}
        profile={sampleProfile}
        onSpecUpdate={handleSpecUpdate}
      />
    );

    const input = screen.getByPlaceholderText(/Refine dashboard with AI/i);
    fireEvent.change(input, { target: { value: 'Change title to Refined Sales Dashboard' } });

    const refineButton = screen.getByRole('button', { name: /Refine/i });
    fireEvent.click(refineButton);

    await waitFor(() => {
      expect(handleSpecUpdate).toHaveBeenCalledWith(updatedSpecMock);
      expect(screen.getByText('Dashboard successfully refined!')).toBeDefined();
      expect(screen.getByText('Changed title')).toBeDefined();
    });

    const undoButton = screen.getByRole('button', { name: /Undo/i });
    fireEvent.click(undoButton);

    expect(handleSpecUpdate).toHaveBeenCalledWith(sampleSpec);
  });

  it('Test 4: AskYourDataDrawer excludes temporal columns from total suggestions', () => {
    const profileWithDates: SheetProfile = {
      ...sampleProfile,
      columnProfiles: [
        {
          columnKey: 'order_date',
          originalName: 'Order Date',
          inferredType: 'date',
          semanticRole: 'time',
          nullable: false,
          nullCount: 0,
          totalCount: 100,
          distinctCount: 50,
          uniquenessRatio: 0.5,
          sampleValues: ['2024-01-01'],
        },
        {
          columnKey: 'revenue',
          originalName: 'Revenue',
          inferredType: 'currency',
          semanticRole: 'measure',
          nullable: false,
          nullCount: 0,
          totalCount: 100,
          distinctCount: 50,
          uniquenessRatio: 0.5,
          sampleValues: ['1000'],
        },
      ],
    };

    render(
      <AskYourDataDrawer
        isOpen={true}
        onClose={vi.fn()}
        sheet={sampleSheet}
        profile={profileWithDates}
        onAddWidget={vi.fn()}
      />
    );

    // It should suggest "Total revenue by order_date" or "Total revenue", but NEVER "Total order_date"
    expect(screen.queryByText(/Total order_date$/i)).toBeNull();
    expect(screen.queryByText(/Total Order Date$/i)).toBeNull();
    expect(screen.getByText(/Total revenue/i)).toBeDefined();
  });

  it('Test 5: AskYourDataDrawer provides conversational narrative and Add & Jump navigation', async () => {
    const handleAddWidget = vi.fn();
    const handleClose = vi.fn();

    const sheetWithRows: SheetModel = {
      ...sampleSheet,
      rows: [
        { region: 'North', revenue: 1500 },
        { region: 'South', revenue: 2500 },
      ],
      rowCount: 2,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          interpretedIntent: 'Total revenue by region',
          sql: 'SELECT "region", SUM("revenue") AS "total_revenue" FROM "sales_data" GROUP BY "region";',
          explanation: 'Generated query for total revenue.',
          suggestedWidget: {
            id: 'widget_region_bar',
            type: 'bar',
            title: 'Revenue by Region',
            grid: { x: 0, y: 0, w: 6, h: 6 },
            dimension: 'region',
            measures: ['revenue'],
            aggregation: 'sum',
            orientation: 'vertical',
          },
        }),
      })
    );

    render(
      <AskYourDataDrawer
        isOpen={true}
        onClose={handleClose}
        sheet={sheetWithRows}
        profile={sampleProfile}
        onAddWidget={handleAddWidget}
      />
    );

    const input = screen.getByPlaceholderText('Ask a question about your data...');
    fireEvent.change(input, { target: { value: 'Compare revenue by region' } });

    const askButton = screen.getByRole('button', { name: /Ask/i });
    fireEvent.click(askButton);

    await waitFor(() => {
      // Conversational narrative generated from data rows
      expect(screen.getByText(/Here is the breakdown for/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Add & Jump/i })).toBeDefined();
    });

    const jumpButton = screen.getByRole('button', { name: /Add & Jump/i });
    fireEvent.click(jumpButton);

    expect(handleAddWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'widget_region_bar',
      })
    );
    expect(handleClose).toHaveBeenCalled();
  });
});
