import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { WorkbookModelSchema, SheetModelSchema } from '@unsheet/contracts';
import {
  normaliseSheet,
  normaliseWorkbook,
  ingestWorkbook,
} from '../../src/index.js';

describe('Normalise Pipeline & Contract Validation', () => {
  it('normalises a raw sheet into a valid SheetModel conforming to @unsheet/contracts', () => {
    const rawSheet = {
      name: 'Q3 Financials',
      grid: [
        ['Acme Financial Report', null, null],
        ['Quarter', 'Revenue', 'Operating Cost'],
        ['Q1', 10000, 7000],
        ['Q2', 12000, 8000],
        ['Subtotal', null, 15000],
        ['* Unaudited', null, null],
      ],
      merges: [],
    };

    const sheetModel = normaliseSheet(rawSheet, 0);

    // Validate against contract schema
    expect(() => SheetModelSchema.parse(sheetModel)).not.toThrow();
    expect(sheetModel.name).toBe('Q3 Financials');
    expect(sheetModel.columns.length).toBe(3);
    expect(sheetModel.rowCount).toBe(2); // Subtotal, title, and footnote stripped
    expect(sheetModel.rows[0]).toEqual({
      quarter: 'Q1',
      revenue: 10000,
      operating_cost: 7000,
    });
  });

  it('normalises a raw workbook into a valid WorkbookModel conforming to @unsheet/contracts', () => {
    const rawWorkbook = {
      filename: 'annual_report.xlsx',
      fileSize: 4096,
      fileType: 'xlsx' as const,
      sheets: [
        {
          name: 'Revenue',
          grid: [
            ['Year', 'Amount'],
            [2023, 50000],
            [2024, 75000],
          ],
          merges: [],
        },
      ],
    };

    const workbookModel = normaliseWorkbook(rawWorkbook);
    expect(() => WorkbookModelSchema.parse(workbookModel)).not.toThrow();
    expect(workbookModel.filename).toBe('annual_report.xlsx');
    expect(workbookModel.sheets.length).toBe(1);
    expect(workbookModel.sheets[0]?.columns[0]?.key).toBe('year');
    expect(workbookModel.metadata?.sheetCount).toBe(1);
  });

  it('executes end-to-end ingestWorkbook pipeline from binary XLSX to WorkbookModel', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Department', 'Headcount', 'Budget'],
      ['Engineering', 45, 1200000],
      ['Marketing', 20, 500000],
      ['Total', 65, 1700000],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Depts');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const model = await ingestWorkbook(buffer, { filename: 'depts.xlsx' });
    expect(() => WorkbookModelSchema.parse(model)).not.toThrow();
    expect(model.filename).toBe('depts.xlsx');
    expect(model.sheets.length).toBe(1);
    expect(model.sheets[0]?.rowCount).toBe(2); // Total subtotal removed
    expect(model.sheets[0]?.columns.map((c) => c.key)).toEqual([
      'department',
      'headcount',
      'budget',
    ]);
  });
});
