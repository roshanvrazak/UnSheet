import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { MAX_COLUMNS } from '@unsheet/contracts';
import {
  normaliseCellValue,
  normaliseSheet,
  normaliseWorkbook,
  validateUploadGuards,
  sanitiseHeaderToken,
  sanitiseHeaders,
  isFootnoteRow,
  parseSheetJs,
  inspectZipArchive,
  computeSha256,
} from '../src/index.js';

describe('Targeted Edge Cases for High Coverage', () => {
  describe('normaliseCellValue', () => {
    it('handles NaN and Infinity by returning null', () => {
      expect(normaliseCellValue(NaN)).toBeNull();
      expect(normaliseCellValue(Infinity)).toBeNull();
      expect(normaliseCellValue(-Infinity)).toBeNull();
    });

    it('handles invalid Dates by returning null', () => {
      const invalidDate = new Date('invalid date string');
      expect(normaliseCellValue(invalidDate)).toBeNull();
    });

    it('handles bigints and objects', () => {
      expect(normaliseCellValue(BigInt(100))).toBe(100);
      expect(normaliseCellValue({ foo: 'bar' })).toBe('[object Object]');
    });

    it('handles booleans and valid Dates', () => {
      expect(normaliseCellValue(true)).toBe(true);
      expect(normaliseCellValue(false)).toBe(false);
      const date = new Date('2024-01-01T00:00:00.000Z');
      expect(normaliseCellValue(date)).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('normaliseSheet bounds and edge cases', () => {


    it('truncates sheet columns when exceeding MAX_COLUMNS', () => {
      // Create a grid with 205 columns
      const wideRow: string[] = [];
      for (let i = 0; i < MAX_COLUMNS + 5; i++) {
        wideRow.push(`Header_${i + 1}`);
      }
      const dataRow = new Array(MAX_COLUMNS + 5).fill(1);
      const wideSheet = {
        name: 'Wide',
        grid: [wideRow, dataRow],
        merges: [],
      };
      const model = normaliseSheet(wideSheet, 0);
      expect(model.columns.length).toBe(MAX_COLUMNS);
    });
  });

  describe('normaliseWorkbook fallback sheet', () => {
    it('creates default fallback sheet when workbook has no sheets', () => {
      const emptyWb = {
        filename: 'empty.xlsx',
        fileSize: 100,
        fileType: 'xlsx' as const,
        sheets: [],
      };
      const model = normaliseWorkbook(emptyWb);
      expect(model.sheets.length).toBe(1);
      expect(model.sheets[0]?.name).toBe('Sheet1');
    });
  });

  describe('validateUploadGuards edge cases', () => {
    it('detects GIF magic bytes as binary', () => {
      const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
      expect(() => validateUploadGuards(gif, 'image.csv')).toThrow();
    });

    it('handles UTF-16 LE and UTF-16 BE BOMs', () => {
      const utf16le = new Uint8Array([0xff, 0xfe, 0x41, 0x00]);
      expect(validateUploadGuards(utf16le, 'text.csv').fileType).toBe('csv');

      const utf16be = new Uint8Array([0xfe, 0xff, 0x00, 0x41]);
      expect(validateUploadGuards(utf16be, 'text.csv').fileType).toBe('csv');
    });

    it('detects binary when control characters exceed 10%', () => {
      // 100 bytes where 20 are non-printable control chars
      const buffer = new Uint8Array(100);
      buffer.fill(0x61); // 'a'
      for (let i = 0; i < 20; i++) {
        buffer[i] = 0x01; // SOH control char
      }
      expect(() => validateUploadGuards(buffer, 'control.csv')).toThrow();
    });

    it('detects delimited text type without extension by counting tabs vs commas', () => {
      const tsvContent = new TextEncoder().encode('colA\tcolB\tcolC\n1\t2\t3\n');
      expect(validateUploadGuards(tsvContent, 'unknown_file').fileType).toBe('tsv');

      const csvContent = new TextEncoder().encode('colA,colB,colC\n1,2,3\n');
      expect(validateUploadGuards(csvContent, 'unknown_file').fileType).toBe('csv');
    });
  });

  describe('isFootnoteRow edge cases', () => {
    it('identifies single-cell long descriptive footnote', () => {
      const longNote = 'This is an extensive disclosure note explaining that all values are approximate and based on estimates.';
      expect(isFootnoteRow([longNote, null, null, null], 4)).toBe(true);
    });
  });

  describe('sanitiseHeaderToken and sanitiseHeaders edge cases', () => {
    it('handles symbol-only tokens that collapse to empty or underscore', () => {
      expect(sanitiseHeaderToken('___', 2)).toBe('col_3');
      expect(sanitiseHeaderToken('!!!', 3)).toBe('col_4');
    });

    it('truncates base key when disambiguation suffix would exceed 128 characters', () => {
      const veryLong = 'col_' + 'a'.repeat(125);
      const keys = sanitiseHeaders([veryLong, veryLong]);
      expect(keys[0]!.length).toBeLessThanOrEqual(128);
      expect(keys[1]!.length).toBeLessThanOrEqual(128);
      expect(keys[0]).not.toBe(keys[1]);
    });
  });

  describe('parseSheetJs edge cases', () => {
    it('handles missing sheet in workbook sheets dictionary', () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['test']]);
      XLSX.utils.book_append_sheet(wb, ws, 'RealSheet');
      // Add fake sheet name that has no entry in wb.Sheets
      wb.SheetNames.push('GhostSheet');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const parsed = parseSheetJs(buf, 'test.xlsx', 'xlsx');
      expect(parsed.sheets.length).toBe(2);
      expect(parsed.sheets[1]?.name).toBe('GhostSheet');
      expect(parsed.sheets[1]?.grid).toEqual([]);
    });


  });

  describe('Local File Header ZIP fallback security checks', () => {
    it('detects macros during local header scan', () => {
      // Craft a local file header with macro filename
      const filename = 'xl/vbaProject.bin';
      const filenameBytes = new TextEncoder().encode(filename);
      const header = new Uint8Array(30 + filenameBytes.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint32(18, 50, true);
      view.setUint32(22, 100, true);
      view.setUint16(26, filenameBytes.length, true);
      view.setUint16(28, 0, true);
      header.set(filenameBytes, 30);

      expect(() => inspectZipArchive(header)).toThrow();
    });

    it('detects zip bomb during local header scan', () => {
      const filename = 'sheet.xml';
      const filenameBytes = new TextEncoder().encode(filename);
      const header = new Uint8Array(30 + filenameBytes.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint32(18, 500, true);
      view.setUint32(22, 250 * 1024 * 1024, true); // 250MB
      view.setUint16(26, filenameBytes.length, true);
      header.set(filenameBytes, 30);

      expect(() => inspectZipArchive(header)).toThrow();
    });

    it('detects excessive compression ratio during local header scan', () => {
      const filename = 'sheet.xml';
      const filenameBytes = new TextEncoder().encode(filename);
      const header = new Uint8Array(30 + filenameBytes.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint32(18, 1000, true); // 1KB
      view.setUint32(22, 5 * 1024 * 1024, true); // 5MB -> 5000:1 ratio
      view.setUint16(26, filenameBytes.length, true);
      header.set(filenameBytes, 30);

      expect(() => inspectZipArchive(header)).toThrow();
    });
  });

  describe('computeSha256 Node fallback', () => {
    it('uses Node.js crypto fallback when subtle crypto is absent', async () => {
      const originalSubtle = globalThis.crypto?.subtle;
      try {
        // Temporarily unset subtle crypto to trigger Node fallback
        Object.defineProperty(globalThis.crypto, 'subtle', {
          value: undefined,
          configurable: true,
        });

        const data = new TextEncoder().encode('fallback test');
        const hash = await computeSha256(data);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      } finally {
        Object.defineProperty(globalThis.crypto, 'subtle', {
          value: originalSubtle,
          configurable: true,
        });
      }
    });
  });
});
