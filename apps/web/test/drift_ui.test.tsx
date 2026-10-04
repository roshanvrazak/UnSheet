import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DriftResolutionModal } from '../components/drift/DriftResolutionModal';
import { DriftReport, DashboardSpec, SheetProfile } from '@unsheet/contracts';

const mockDriftReport: DriftReport = {
  templateId: 't-1',
  sourceSheetName: 'Sheet1',
  overallConfidence: 0.85,
  hasBreakingChanges: false,
  matchedColumns: [
    { expectedKey: 'arr', actualKey: 'arr', confidence: 1.0 },
    { expectedKey: 'month', actualKey: 'month', confidence: 1.0 }
  ],
  missingColumns: [],
  addedColumns: [],
  typeMismatches: [],
  suggestedRemappings: []
};

const mockSpec: DashboardSpec = {
  version: '1.0',
  id: 'dash_1',
  sheetBinding: 'sheet_1',
  title: 'Test Dashboard',
  layout: { columns: 12, gap: 16, padding: 16 },
  widgets: [
    {
      id: 'w_1',
      type: 'kpi',
      title: 'ARR by Tier',
      measure: 'arr',
      aggregation: 'sum',
      grid: { x: 0, y: 0, w: 4, h: 2 }
    }
  ],
  filters: []
};

const mockProfile: SheetProfile = {
  sheetId: 's1',
  sheetName: 'Sheet1',
  rowCount: 100,
  columnProfiles: [
    { columnKey: 'arr', originalName: 'arr', inferredType: 'number', semanticRole: 'measure', nullable: false, nullCount: 0, totalCount: 100, distinctCount: 50, uniquenessRatio: 0.5, sampleValues: ['100', '200'] },
    { columnKey: 'month', originalName: 'month', inferredType: 'text', semanticRole: 'dimension', nullable: false, nullCount: 0, totalCount: 100, distinctCount: 12, uniquenessRatio: 0.12, sampleValues: ['Jan', 'Feb'] },
    { columnKey: 'plan', originalName: 'plan', inferredType: 'text', semanticRole: 'dimension', nullable: false, nullCount: 0, totalCount: 100, distinctCount: 3, uniquenessRatio: 0.03, sampleValues: ['Pro', 'Enterprise'] }
  ],
  recommendedDimensions: ['month', 'plan'],
  recommendedMeasures: ['arr']
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
