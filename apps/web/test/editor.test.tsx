import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterConfigModal } from '../components/editor/FilterConfigModal';
import { SheetProfile } from '@unsheet/contracts';

const mockProfile: SheetProfile = {
  sheetId: 's1',
  rowCount: 100,
  columnCount: 3,
  columnProfiles: [
    { columnKey: 'arr', originalName: 'arr', type: 'number', semanticRole: 'measure', missingCount: 0, uniqueCount: 50 },
    { columnKey: 'month', originalName: 'month', type: 'string', semanticRole: 'dimension', missingCount: 0, uniqueCount: 12 },
    { columnKey: 'tier', originalName: 'tier', type: 'string', semanticRole: 'dimension', missingCount: 0, uniqueCount: 3 }
  ]
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
