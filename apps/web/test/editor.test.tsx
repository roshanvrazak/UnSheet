import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterConfigModal } from '../components/editor/FilterConfigModal';
import { SheetProfile } from '@unsheet/contracts';

const mockProfile: SheetProfile = {
  sheetId: 's1',
  sheetName: 'Sheet1',
  rowCount: 100,
  columnProfiles: [
    { columnKey: 'arr', originalName: 'arr', inferredType: 'number', semanticRole: 'measure', nullable: false, nullCount: 0, totalCount: 100, distinctCount: 50, uniquenessRatio: 0.5, sampleValues: ['100', '200'] },
    { columnKey: 'month', originalName: 'month', inferredType: 'text', semanticRole: 'dimension', nullable: false, nullCount: 0, totalCount: 100, distinctCount: 12, uniquenessRatio: 0.12, sampleValues: ['Jan', 'Feb'] },
    { columnKey: 'tier', originalName: 'tier', inferredType: 'text', semanticRole: 'dimension', nullable: false, nullCount: 0, totalCount: 100, distinctCount: 3, uniquenessRatio: 0.03, sampleValues: ['Standard', 'Enterprise'] }
  ],
  recommendedDimensions: ['month', 'tier'],
  recommendedMeasures: ['arr']
};

describe('FilterConfigModal Test Suite', () => {
  it('renders and adds global filter when clicked', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <FilterConfigModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        sheetProfile={mockProfile}
      />
    );

    expect(screen.getByText('Add Global Filter')).toBeDefined();
    
    // Select column first so it has a columnKey
    const triggers = screen.getAllByRole('button');
    const columnTrigger = triggers.find(b => b.textContent?.includes('Select column'));
    if (columnTrigger) {
      fireEvent.click(columnTrigger);
      const tierItem = screen.getByText(/tier/i);
      if (tierItem) fireEvent.click(tierItem);
    }

    fireEvent.click(screen.getByRole('button', { name: /Add Filter/i }));
    expect(handleSave).toHaveBeenCalled();
  });
});
