// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioNavbar } from '../../components/studio/StudioNavbar';

describe('StudioNavbar Component', () => {
  it('renders brand logo, in-browser privacy badge, and upload actions', () => {
    const handleUploadClick = vi.fn();
    const handleShareClick = vi.fn();
    const handleToggleInspector = vi.fn();

    render(
      <StudioNavbar
        workbookName="quarterly-sales.xlsx"
        activeSheetName="Q3 Summary"
        rowCount={1240}
        colCount={8}
        onUploadClick={handleUploadClick}
        onShareClick={handleShareClick}
        isInspectorOpen={true}
        onToggleInspector={handleToggleInspector}
        onSelectSample={vi.fn()}
      />
    );

    // Brand and breadcrumbs
    expect(screen.getByText('Unsheet')).toBeDefined();
    expect(screen.getByText('quarterly-sales.xlsx')).toBeDefined();
    expect(screen.getByText('Q3 Summary')).toBeDefined();

    // Privacy badge
    expect(screen.getByText(/In-Browser Privacy/i)).toBeDefined();

    // Inspector toggle
    const toggleBtn = screen.getByLabelText(/Toggle sheet and field inspector/i);
    fireEvent.click(toggleBtn);
    expect(handleToggleInspector).toHaveBeenCalled();

    // Upload button
    const uploadBtn = screen.getByText(/New File/i);
    fireEvent.click(uploadBtn);
    expect(handleUploadClick).toHaveBeenCalled();

    // Share button
    const shareBtn = screen.getByText(/Share/i);
    fireEvent.click(shareBtn);
    expect(handleShareClick).toHaveBeenCalled();
  });

  it('renders clean fallback breadcrumb when no workbook is loaded', () => {
    render(
      <StudioNavbar
        onUploadClick={vi.fn()}
        onShareClick={vi.fn()}
        isInspectorOpen={false}
        onToggleInspector={vi.fn()}
        onSelectSample={vi.fn()}
      />
    );

    expect(screen.getByText('Unsheet')).toBeDefined();
    expect(screen.getByText('Studio')).toBeDefined();
  });
});
