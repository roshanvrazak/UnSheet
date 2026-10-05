// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingCommandBar } from '../../components/studio/FloatingCommandBar';
import type { SheetModel } from '@unsheet/contracts';

const mockSheet: SheetModel = {
  id: 'sheet-1',
  name: 'Sales Data',
  rowCount: 100,
  columnCount: 2,
  headers: ['item', 'price'],
  data: [],
};

describe('FloatingCommandBar Component', () => {
  it('renders command actions and fires appropriate click handlers', () => {
    const handleAskClick = vi.fn();
    const handleRefineClick = vi.fn();
    const handleShareClick = vi.fn();
    const handleToggleInspector = vi.fn();

    render(
      <FloatingCommandBar
        onAskClick={handleAskClick}
        onRefineClick={handleRefineClick}
        isRefineOpen={false}
        sheet={mockSheet}
        onShareClick={handleShareClick}
        onToggleInspector={handleToggleInspector}
        isInspectorOpen={true}
      />
    );

    // Ask AI
    const askBtn = screen.getByText('Ask AI');
    fireEvent.click(askBtn);
    expect(handleAskClick).toHaveBeenCalled();

    // Refine
    const refineBtn = screen.getByText('Refine');
    fireEvent.click(refineBtn);
    expect(handleRefineClick).toHaveBeenCalled();

    // Share
    const shareBtn = screen.getByText('Share');
    fireEvent.click(shareBtn);
    expect(handleShareClick).toHaveBeenCalled();

    // Inspector toggle
    const inspectorBtn = screen.getByLabelText(/Toggle sheet inspector/i);
    fireEvent.click(inspectorBtn);
    expect(handleToggleInspector).toHaveBeenCalled();
  });
});
