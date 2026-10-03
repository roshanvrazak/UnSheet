import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  normaliseSheet,
  ingestWorkbook,
  ZipBombError,
  MacroNotAllowedError,
  CorruptedFileError,
  inspectZipArchive,
} from '../../src/index.js';

describe('Security Invariants & Hardening', () => {
  describe('Prototype Pollution Defense', () => {
    it('neutralizes __proto__, constructor, and prototype column headers', () => {
      // Clear any existing pollution check
      delete (Object.prototype as Record<string, unknown>)['polluted'];
      delete (Object.prototype as Record<string, unknown>)['isAdmin'];

      const rawSheet = {
        name: 'ExploitSheet',
        grid: [
          ['__proto__', 'constructor', 'prototype', '__proto__'],
          ['polluted', 'isAdmin', 'value', 'polluted_again'],
        ],
        merges: [],
      };

      const sheetModel = normaliseSheet(rawSheet, 0);

      expect(sheetModel.columns.map((c) => c.key)).toEqual([
        'safe___proto__',
        'safe_constructor',
        'safe_prototype',
        'safe___proto___1',
      ]);

      // Verify Object prototype was NEVER polluted
      expect((Object.prototype as Record<string, unknown>)['polluted']).toBeUndefined();
      expect((Object.prototype as Record<string, unknown>)['isAdmin']).toBeUndefined();
      expect({}['polluted' as keyof object]).toBeUndefined();
    });

    it('creates row records that do not trigger prototype injection', () => {
      const rawSheet = {
        name: 'RecordSheet',
        grid: [
          ['col_a', 'col_b'],
          ['val1', 'val2'],
        ],
        merges: [],
      };

      const sheetModel = normaliseSheet(rawSheet, 0);
      const row = sheetModel.rows[0];

      expect(row).toBeDefined();
      expect(Object.prototype.hasOwnProperty.call(row, 'col_a')).toBe(true);
      expect((Object.prototype as Record<string, unknown>)['col_a']).toBeUndefined();
    });
  });

  describe('Hostile Formulas Never Evaluated', () => {
    it('does not evaluate malicious Excel formulas at runtime', async () => {
      const wb = XLSX.utils.book_new();
      const ws: XLSX.WorkSheet = {
        '!ref': 'A1:B2',
        A1: { t: 's', v: 'Header1' },
        B1: { t: 's', v: 'FormulaCol' },
        // Malicious CSV/Excel injection formulas
        A2: { t: 's', v: 'Row1' },
        B2: { t: 's', v: 'cached_safe_val', f: '=cmd|\'/C calc\'!A0' },
      };
      XLSX.utils.book_append_sheet(wb, ws, 'Injections');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const model = await ingestWorkbook(buf, { filename: 'hostile.xlsx' });
      const row = model.sheets[0]?.rows[0];

      // Strictly the cached value was read, formula was never evaluated
      expect(row?.['formula_col']).toBe('cached_safe_val');
    });
  });

  describe('Zip Bomb & Macro Rejection', () => {
    it('fails closed on macro-enabled extensions without processing', async () => {
      const dummy = new Uint8Array(100);
      await expect(ingestWorkbook(dummy, { filename: 'exploit.xlsm' })).rejects.toThrow(
        MacroNotAllowedError
      );
    });

    it('fails closed when zip exceeds 200MB uncompressed limit', () => {
      // Craft a mock zip header declaring 300MB uncompressed
      const header = new Uint8Array(30);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint32(18, 100, true); // compressed 100
      view.setUint32(22, 300 * 1024 * 1024, true); // uncompressed 300MB
      view.setUint16(26, 0, true); // filename len 0
      view.setUint16(28, 0, true);

      expect(() => inspectZipArchive(header)).toThrow(ZipBombError);
    });

    it('fails closed on corrupted or truncated binary streams', async () => {
      const corruptedZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
      await expect(ingestWorkbook(corruptedZip, { filename: 'broken.xlsx' })).rejects.toThrow(
        CorruptedFileError
      );
    });
  });
});
