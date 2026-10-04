import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ExportDropdown } from '../components/export/ExportDropdown';
import { ShareModal } from '../components/share/ShareModal';
import SharedDashboardPage from '../app/share/[token]/page';
import type { SheetModel, DashboardSpec } from '@unsheet/contracts';
import { createShareLink } from '../lib/share/store';

const mockSheet: SheetModel = {
  id: 'sheet_1',
  name: 'Financials',
  headers: {
    detectedRowIndex: 0,
    confidence: 1.0,
    originalHeaders: ['Month', 'Revenue'],
    sanitizedKeys: ['month', 'revenue'],
  },
  columns: [
    { key: 'month', originalName: 'Month', columnIndex: 0 },
    { key: 'revenue', originalName: 'Revenue', columnIndex: 1 },
  ],
  rows: [
    { month: 'Jan', revenue: 1000 },
    { month: 'Feb', revenue: 1500 },
  ],
  rowCount: 2,
  columnCount: 2,
};

const mockSpec: DashboardSpec = {
  version: '1.0',
  id: 'dash_1',
  title: 'Shared Financials Dashboard',
  sheetBinding: 'sheet_1',
  layout: { columns: 12, gap: 16, padding: 16 },
  filters: [],
  widgets: [
    {
      id: 'w_1',
      type: 'kpi',
      title: 'Total Revenue',
      measure: 'revenue',
      aggregation: 'sum',
      grid: { x: 0, y: 0, w: 4, h: 2 },
    },
  ],
};

describe('Phase 6 Frontend Share & Export UI Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Test 1: ExportDropdown renders and triggers CSV, JSON, and XLSX export functions', () => {
    render(<ExportDropdown sheet={mockSheet} />);

    const exportBtn = screen.getByRole('button', { name: /Export options/i });
    expect(exportBtn).toBeDefined();

    // Open dropdown
    fireEvent.click(exportBtn);

    expect(screen.getByRole('menu', { name: /Export options menu/i })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /Export CSV/i })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /Export Excel/i })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /Export JSON/i })).toBeDefined();

    // Mock createObjectURL & click
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:url');
    const revokeObjectURLSpy = vi.fn();
    global.URL.createObjectURL = createObjectURLSpy;
    global.URL.revokeObjectURL = revokeObjectURLSpy;

    // Trigger CSV export
    fireEvent.click(screen.getByRole('menuitem', { name: /Export CSV/i }));
    expect(createObjectURLSpy).toHaveBeenCalled();
  });

  it('Test 2: ShareModal renders options, calls /api/share, displays generated token link, and handles copying', async () => {
    const handleClose = vi.fn();

    // Mock fetch for POST /api/share
    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        shareToken: 'test-token-123',
        shareUrl: 'http://localhost:3000/share/test-token-123',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    vi.stubGlobal('fetch', globalFetch);

    // Mock clipboard
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    render(
      <ShareModal
        isOpen={true}
        onClose={handleClose}
        spec={mockSpec}
        sheet={mockSheet}
      />
    );

    expect(screen.getByRole('dialog', { name: /Share Dashboard/i })).toBeDefined();
    expect(screen.getByText('Link Expiry')).toBeDefined();
    expect(screen.getByText('Allow Export')).toBeDefined();
    expect(screen.getByText('Include Data Snapshot')).toBeDefined();

    // Click create share link
    const createBtn = screen.getByRole('button', { name: /Create Share Link/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(globalFetch).toHaveBeenCalledWith(
        '/api/share',
        expect.objectContaining({ method: 'POST' })
      );
    });

    // Check shareable link input appears
    const linkInput = await screen.findByDisplayValue('http://localhost:3000/share/test-token-123');
    expect(linkInput).toBeDefined();

    // Test copy link
    const copyBtn = screen.getByRole('button', { name: /Copy Link/i });
    fireEvent.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith('http://localhost:3000/share/test-token-123');
  });





  it('Test 3: share/[token]/page.tsx renders shared dashboard when API succeeds', async () => {
    const { shareToken } = await createShareLink({
      title: 'Shared Financials Dashboard',
      spec: mockSpec,
      allowExport: true,
      dataSnapshot: mockSheet.rows,
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        title: 'Shared Financials Dashboard',
        spec: mockSpec,
        allowExport: true,
        dataSnapshot: mockSheet.rows,
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await act(async () => {
      render(<SharedDashboardPage params={Promise.resolve({ token: shareToken })} />);
    });

    const dashboardTitles = await screen.findAllByText('Shared Financials Dashboard');
    expect(dashboardTitles.length).toBeGreaterThan(0);
    expect(screen.getByText('Shared Dashboard (Read-Only)')).toBeDefined();
  });

  it('Test 3b: share/[token]/page.tsx shows error card when API returns 404', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Share link not found or expired' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await act(async () => {
      render(<SharedDashboardPage params={Promise.resolve({ token: 'non-existent' })} />);
    });

    const errorHeading = await screen.findByText('Dashboard Unavailable');
    expect(errorHeading).toBeDefined();
    expect(screen.getByText('This shared dashboard does not exist, has expired, or was revoked.')).toBeDefined();
  });
});
