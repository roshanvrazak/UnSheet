import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseWorkbook,
  parseSheetJs,
  SheetBoundsError,
  CorruptedFileError,
  computeSha256,
} from '../../src/parse/index.js';

describe('SheetJS Ingest Parser', () => {
  it('parses a basic XLSX workbook safely', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['ID', 'Name', 'Score'],
      [1, 'Alice', 95],
      [2, 'Bob', 88],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Scores');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const parsed = await parseWorkbook(buf, { filename: 'test.xlsx' });
    expect(parsed.filename).toBe('test.xlsx');
    expect(parsed.fileType).toBe('xlsx');
    expect(parsed.sheets.length).toBe(1);
    expect(parsed.sheets[0]?.name).toBe('Scores');
    expect(parsed.sheets[0]?.grid.length).toBe(3);
    expect(parsed.sheets[0]?.grid[0]).toEqual(['ID', 'Name', 'Score']);
    expect(parsed.sheets[0]?.grid[1]).toEqual([1, 'Alice', 95]);
  });

  it('reads cached formula values (cell.v) and never evaluates formulas', () => {
    const wb = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = {
      '!ref': 'A1:B1',
      A1: { t: 'n', v: 42, f: '1+1' }, // formula is 1+1, cached value is 42
      B1: { t: 's', v: 'cached_text', f: 'WEBSERVICE("http://evil.com")' },
    };
    XLSX.utils.book_append_sheet(wb, ws, 'Formulas');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const parsed = parseSheetJs(buf, 'formulas.xlsx', 'xlsx');
    const grid = parsed.sheets[0]?.grid;
    expect(grid?.[0]?.[0]).toBe(42); // strictly reads cell.v
    expect(grid?.[0]?.[1]).toBe('cached_text');
  });

  it('extracts merged cell regions accurately', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Category', null, 'Sales'],
      ['Electronics', 'Phones', 100],
    ]);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, // Merge A1:B1
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Merges');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const parsed = parseSheetJs(buf, 'merges.xlsx', 'xlsx');
    const sheet = parsed.sheets[0];
    expect(sheet?.merges.length).toBe(1);
    expect(sheet?.merges[0]).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 1,
    });
  });

  it('rejects workbooks exceeding MAX_SHEETS (20 sheets)', () => {
    const wb = XLSX.utils.book_new();
    for (let i = 0; i < 21; i++) {
      const ws = XLSX.utils.aoa_to_sheet([['test']]);
      XLSX.utils.book_append_sheet(wb, ws, `Sheet${i + 1}`);
    }
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    expect(() => parseSheetJs(buf, 'many_sheets.xlsx', 'xlsx')).toThrow(SheetBoundsError);
  });

  it('rejects sheets exceeding MAX_COLUMNS (200 columns)', () => {
    const wb = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = {
      '!ref': 'A1:HX1', // HX is column 232 (exceeding 200)
    };
    XLSX.utils.book_append_sheet(wb, ws, 'WideSheet');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    expect(() => parseSheetJs(buf, 'wide.xlsx', 'xlsx')).toThrow(SheetBoundsError);
  });

  it('rejects sheets exceeding MAX_ROWS (200,000 rows)', () => {
    const wb = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = {
      '!ref': 'A1:B250000',
    };
    XLSX.utils.book_append_sheet(wb, ws, 'DeepSheet');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    expect(() => parseSheetJs(buf, 'deep.xlsx', 'xlsx')).toThrow(SheetBoundsError);
  });

  it('parses CSV input smoothly via parseWorkbook', async () => {
    const csvContent = 'Region,Sales,Active\nNorth,500,true\nSouth,300,false\n';
    const csvBuf = new TextEncoder().encode(csvContent);

    const parsed = await parseWorkbook(csvBuf, { filename: 'sales.csv' });
    expect(parsed.fileType).toBe('csv');
    expect(parsed.sheets.length).toBe(1);
    expect(parsed.sheets[0]?.grid.length).toBe(3);
    expect(parsed.sheets[0]?.grid[0]).toEqual(['Region', 'Sales', 'Active']);
  });

  it('computes 64-character SHA-256 hex digest for workbook metadata', async () => {
    const data = new TextEncoder().encode('deterministic content');
    const hash = await computeSha256(data);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('throws CorruptedFileError on corrupted binary data', () => {
    const garbage = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff, 0xff, 0xff, 0x00, 0x01]);
    expect(() => parseSheetJs(garbage, 'corrupt.xlsx', 'xlsx')).toThrow(CorruptedFileError);
  });
});
