import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DriftResolutionModal } from '../components/drift/DriftResolutionModal';
import { DriftReport, DashboardSpec, SheetProfile } from '@unsheet/contracts';

const mockDriftReport: DriftReport = {
  templateId: 't-1',
  confidenceScore: 0.85,
  matchedColumns: ['arr', 'month'],
  missingColumns: [],
  suggestedRemappings: {},
  breakingChanges: false
};

const mockSpec: DashboardSpec = {
  version: '1.0',
  id: 'dash_1',
  sheetBinding: 'sheet_1',
  title: 'Test Dashboard',
  widgets: [
    {
      id: 'w_1',
      type: 'kpi',
      title: 'ARR by Tier',
      measure: 'arr',
      dimension: 'tier',
      aggregation: 'sum',
      grid: { x: 0, y: 0, w: 4, h: 2 },
      layout: { x: 0, y: 0, w: 4, h: 2 }
    }
  ],
  filters: []
} as Record<string, unknown>;

const mockProfile: SheetProfile = {
  sheetId: 's1',
  rowCount: 100,
  columnCount: 3,
  columnProfiles: [
    { key: 'arr', type: 'number', semanticRole: 'measure', missingCount: 0, uniqueCount: 50 },
    { key: 'month', type: 'string', semanticRole: 'dimension', missingCount: 0, uniqueCount: 12 },
    { key: 'plan', type: 'string', semanticRole: 'dimension', missingCount: 0, uniqueCount: 3 }
  ]
};

describe('Schema Drift UI Test Suite', () => {
  it('renders DriftResolutionModal with confidence score and applies remappings', () => {
    const handleClose = vi.fn();
    const handleApply = vi.fn();

    render(
      <DriftResolutionModal
        isOpen={true}
        onClose={handleClose}
        driftReport={mockDriftReport}
        templateSpec={mockSpec}
        newSheetProfile={mockProfile}
        onApplyRemappings={handleApply}
      />
    );

    expect(screen.getByText('Schema Drift Detected')).toBeDefined();
    expect(screen.getByText('85%')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Apply & Remap Dashboard/i }));
    expect(handleApply).toHaveBeenCalled();
  });
});
