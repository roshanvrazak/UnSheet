// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  parseWorkbook,
  normaliseWorkbook,
  profileSheet,
  generateDashboardSpec,
} from '@unsheet/engine';
import { getSampleWorkbookBytes } from '../lib/sample-workbooks';
import HomePage from '../app/page';

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe('Anonymous Demo App (HomePage)', () => {
  it('renders header, brand logo, tagline, and Privacy Badge', async () => {
    render(<HomePage />);

    // Brand and tagline
    expect(screen.getByText('Unsheet')).toBeDefined();
    expect(
      screen.getByText('Any spreadsheet. Instant dashboard.')
    ).toBeDefined();

    // Privacy badge
    expect(
      screen.getByText(/100% In-Browser: your data never leaves your device/i)
    ).toBeDefined();

    // Upload zone
    expect(screen.getByText('Drop your spreadsheet here')).toBeDefined();
    expect(screen.getByText(/Zero server upload/i)).toBeDefined();

    // Initial load auto-renders Project Pipeline dashboard
    await waitFor(
      () => {
        expect(screen.getByText(/Engine Pipeline/i)).toBeDefined();
      },
      { timeout: 3000 }
    );
  });

  it('renders all 4 one-click sample loader buttons with metadata', () => {
    render(<HomePage />);

    expect(screen.getByText('Project Pipeline')).toBeDefined();
    expect(screen.getByText('BOQ & Quotes')).toBeDefined();
    expect(screen.getByText('Supplier Lead Times')).toBeDefined();
    expect(screen.getByText('Messy Workbook')).toBeDefined();

    expect(screen.getByText('Domain 1')).toBeDefined();
    expect(screen.getByText('Domain 2')).toBeDefined();
    expect(screen.getByText('Domain 3')).toBeDefined();
    expect(screen.getByText('Fixture 2')).toBeDefined();
  });

  it('switching sample triggers full pipeline execution and updates timing metrics', async () => {
    render(<HomePage />);

    // Wait for initial load to complete
    await waitFor(() => {
      expect(screen.getByText('1. Parse')).toBeDefined();
    });

    expect(screen.getByText('2. Normalise')).toBeDefined();
    expect(screen.getByText('3. Profile')).toBeDefined();
    expect(screen.getByText('4. SpecGen')).toBeDefined();
    expect(screen.getByText('5. Render')).toBeDefined();

    // Click "BOQ & Quotes"
    const boqBtn = screen.getByRole('button', { name: /BOQ & Quotes/i });
    fireEvent.click(boqBtn);

    // Should switch to Bill of Quantities dashboard
    await waitFor(
      () => {
        expect(screen.getByText(/Bill of Quantities/i)).toBeDefined();
      },
      { timeout: 3000 }
    );
  });

  it('loads Messy Workbook (Fixture 2) with header offset successfully', async () => {
    const { bytes, meta } = getSampleWorkbookBytes('messy-workbook');
    expect(bytes.length).toBeGreaterThan(0);
    const raw = await parseWorkbook(bytes, { filename: meta.filename, calculateHash: false });
    expect(raw.sheets.length).toBe(1);
    const model = normaliseWorkbook(raw);
    expect(model.sheets.length).toBe(1);
    expect(model.sheets[0]?.name).toBe('Q3_Sales');
    const prof = profileSheet(model.sheets[0]!);
    const spec = generateDashboardSpec(prof);
    expect(spec.title).toBeDefined();
    expect(spec.widgets.length).toBeGreaterThan(0);
  });

  it('file upload processes spreadsheet and renders dashboard', async () => {
    const csvContent = 'Project,Budget,Spent\nApollo,1000000,750000\nGemini,800000,600000';
    const csvFile = new window.File([csvContent], 'projects.csv', { type: 'text/csv' });

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('1. Parse')).toBeDefined();
    });

    const fileInput = screen.getByTestId('file-upload-input');
    expect(fileInput).toBeDefined();

    fireEvent.change(fileInput, { target: { files: [csvFile] } });

    await waitFor(
      () => {
        expect(screen.getByText('Sheet1 Dashboard')).toBeDefined();
        expect(screen.getByText('Apollo')).toBeDefined();
      },
      { timeout: 3000 }
    );
  });
});
