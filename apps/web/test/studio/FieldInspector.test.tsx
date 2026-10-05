// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldInspector } from '../../components/studio/FieldInspector';
import type { SheetModel, ColumnProfile } from '@unsheet/contracts';

const mockSheets: SheetModel[] = [
  {
    id: 'sheet-1',
    name: 'Sales Pipeline',
    rowCount: 250,
    columnCount: 3,
    headers: {
      detectedRowIndex: 0,
      confidence: 1,
      originalHeaders: ['deal_id', 'revenue', 'stage'],
      sanitizedKeys: ['deal_id', 'revenue', 'stage'],
    },
    columns: [
      { key: 'deal_id', originalName: 'deal_id', columnIndex: 0 },
      { key: 'revenue', originalName: 'revenue', columnIndex: 1 },
      { key: 'stage', originalName: 'stage', columnIndex: 2 },
    ],
    rows: [],
  },
  {
    id: 'sheet-2',
    name: 'Team Members',
    rowCount: 12,
    columnCount: 2,
    headers: {
      detectedRowIndex: 0,
      confidence: 1,
      originalHeaders: ['rep_id', 'name'],
      sanitizedKeys: ['rep_id', 'name'],
    },
    columns: [
      { key: 'rep_id', originalName: 'rep_id', columnIndex: 0 },
      { key: 'name', originalName: 'name', columnIndex: 1 },
    ],
    rows: [],
  },
];

const mockColumns: ColumnProfile[] = [
  {
    originalName: 'revenue',
    columnKey: 'revenue',
    inferredType: 'currency',
    semanticRole: 'measure',
    nullable: false,
    nullCount: 0,
    totalCount: 250,
    distinctCount: 180,
    uniquenessRatio: 0.72,
    stats: { min: 1000, max: 50000, mean: 12500, sum: 3125000 },
    sampleValues: ['1000', '2500', '5000'],
  },
  {
    originalName: 'stage',
    columnKey: 'stage',
    inferredType: 'category',
    semanticRole: 'dimension',
    nullable: false,
    nullCount: 0,
    totalCount: 250,
    distinctCount: 5,
    uniquenessRatio: 0.02,
    sampleValues: ['Lead', 'Negotiation', 'Closed Won'],
  },
];

describe('FieldInspector Component', () => {
  it('renders sheets, row counts, and column fields with type badges', () => {
    const handleSelectSheet = vi.fn();
    const handleToggleColumn = vi.fn();
    const handleApplyFields = vi.fn();

    render(
      <FieldInspector
        isOpen={true}
        onClose={vi.fn()}
        sheets={mockSheets}
        activeSheetIndex={0}
        onSelectSheet={handleSelectSheet}
        columnProfiles={mockColumns}
        selectedColumnKeys={new Set(['revenue', 'stage'])}
        onToggleColumn={handleToggleColumn}
        onSelectAll={vi.fn()}
        onClearAll={vi.fn()}
        onApplyFields={handleApplyFields}
        isDirty={false}
        pipelineTiming={{
          parseMs: 2.1,
          normaliseMs: 1.5,
          profileMs: 4.2,
          specGenMs: 3.0,
          renderMs: 1.2,
          totalMs: 12.0,
        }}
      />
    );

    // Sheets list
    expect(screen.getByText('Sales Pipeline')).toBeDefined();
    expect(screen.getByText('Team Members')).toBeDefined();

    // Column fields
    expect(screen.getByText('revenue')).toBeDefined();
    expect(screen.getByText('stage')).toBeDefined();

    // Type badge
    expect(screen.getByText('currency')).toBeDefined();
    expect(screen.getByText('category')).toBeDefined();

    // Telemetry badge
    expect(screen.getByText(/12ms in WASM/i)).toBeDefined();
  });

  it('triggers onToggleColumn when a field checkbox is toggled', () => {
    const handleToggleColumn = vi.fn();
    render(
      <FieldInspector
        isOpen={true}
        onClose={vi.fn()}
        sheets={mockSheets}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
        columnProfiles={mockColumns}
        selectedColumnKeys={new Set(['revenue'])}
        onToggleColumn={handleToggleColumn}
        onSelectAll={vi.fn()}
        onClearAll={vi.fn()}
        onApplyFields={vi.fn()}
        isDirty={true}
      />
    );

    const stageCheckbox = screen.getByLabelText(/toggle stage/i);
    fireEvent.click(stageCheckbox);
    expect(handleToggleColumn).toHaveBeenCalledWith('stage');
  });

  it('enables Apply Changes button when isDirty is true and calls onApplyFields', () => {
    const handleApplyFields = vi.fn();
    render(
      <FieldInspector
        isOpen={true}
        onClose={vi.fn()}
        sheets={mockSheets}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
        columnProfiles={mockColumns}
        selectedColumnKeys={new Set(['revenue'])}
        onToggleColumn={vi.fn()}
        onSelectAll={vi.fn()}
        onClearAll={vi.fn()}
        onApplyFields={handleApplyFields}
        isDirty={true}
      />
    );

    const applyBtn = screen.getByText(/Update Dashboard/i);
    fireEvent.click(applyBtn);
    expect(handleApplyFields).toHaveBeenCalled();
  });
});
