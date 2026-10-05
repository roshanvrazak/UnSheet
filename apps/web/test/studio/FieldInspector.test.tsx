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
    headers: ['deal_id', 'revenue', 'stage'],
    data: [],
  },
  {
    id: 'sheet-2',
    name: 'Team Members',
    rowCount: 12,
    columnCount: 2,
    headers: ['rep_id', 'name'],
    data: [],
  },
];

const mockColumns: ColumnProfile[] = [
  {
    columnKey: 'revenue',
    inferredType: 'currency',
    semanticRole: 'measure',
    nullCount: 0,
    totalCount: 250,
    uniqueCount: 180,
    stats: { min: 1000, max: 50000, avg: 12500, sum: 3125000 },
    samples: [1000, 2500, 5000],
  },
  {
    columnKey: 'stage',
    inferredType: 'category',
    semanticRole: 'dimension',
    nullCount: 0,
    totalCount: 250,
    uniqueCount: 5,
    samples: ['Lead', 'Negotiation', 'Closed Won'],
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
