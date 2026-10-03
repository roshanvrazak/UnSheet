import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  SampleValueSchema,
  MAX_FILE_SIZE_BYTES,
} from '@unsheet/contracts';
import {
  inspectZipArchive,
  validateUploadGuards,
  parseSheetJs,
  normaliseSheet,
  ingestWorkbook,
  detectHeaderRow,
  sanitiseHeaders,
  applyMergeForwardFill,
  removeNoiseRows,
  ZipBombError,
  MacroNotAllowedError,
  CorruptedFileError,
  FileSizeLimitError,
  MagicBytesMismatchError,
} from '../../src/index.js';

/**
 * Utility to craft a mock ZIP archive buffer containing Central Directory entries
 * and End of Central Directory (EOCD).
 */
function createMockZipWithCD(
  entries: Array<{
    filename: string;
    compressedSize: number;
    uncompressedSize: number;
  }>,
  options?: {
    customCdSig?: number;
    overrideCdSize?: number;
    overrideCdOffset?: number;
    overrideCdCount?: number;
  }
): Uint8Array {
  const encoder = new TextEncoder();
  const cdEntryBuffers: Uint8Array[] = [];

  for (const entry of entries) {
    const filenameBytes = encoder.encode(entry.filename);
    const buf = new Uint8Array(46 + filenameBytes.length);
    const view = new DataView(buf.buffer);

    view.setUint32(0, options?.customCdSig ?? 0x02014b50, true); // Central directory file header signature
    view.setUint16(4, 20, true); // Version made by
    view.setUint16(6, 20, true); // Version needed to extract
    view.setUint16(8, 0, true); // General purpose bit flag
    view.setUint16(10, 8, true); // Compression method (deflate)
    view.setUint16(12, 0, true); // File mod time
    view.setUint16(14, 0, true); // File mod date
    view.setUint32(16, 0x12345678, true); // CRC-32
    view.setUint32(20, entry.compressedSize, true); // Compressed size
    view.setUint32(24, entry.uncompressedSize, true); // Uncompressed size
    view.setUint16(28, filenameBytes.length, true); // File name length
    view.setUint16(30, 0, true); // Extra field length
    view.setUint16(32, 0, true); // File comment length
    view.setUint16(34, 0, true); // Disk number start
    view.setUint16(36, 0, true); // Internal file attributes
    view.setUint32(38, 0, true); // External file attributes
    view.setUint32(42, 0, true); // Relative offset of local header

    buf.set(filenameBytes, 46);
    cdEntryBuffers.push(buf);
  }

  const cdTotalSize = cdEntryBuffers.reduce((sum, b) => sum + b.length, 0);
  const cdBuffer = new Uint8Array(cdTotalSize);
  let cdOffset = 0;
  for (const b of cdEntryBuffers) {
    cdBuffer.set(b, cdOffset);
    cdOffset += b.length;
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdView.setUint16(4, 0, true); // Number of this disk
  eocdView.setUint16(6, 0, true); // Disk where CD starts
  eocdView.setUint16(8, options?.overrideCdCount ?? entries.length, true); // Number of CD records on disk
  eocdView.setUint16(10, options?.overrideCdCount ?? entries.length, true); // Total number of CD records
  eocdView.setUint32(12, options?.overrideCdSize ?? cdTotalSize, true); // Size of central directory
  eocdView.setUint32(16, options?.overrideCdOffset ?? 0, true); // Offset of start of CD
  eocdView.setUint16(20, 0, true); // Comment length

  const fullZip = new Uint8Array(cdTotalSize + 22);
  fullZip.set(cdBuffer, 0);
  fullZip.set(eocd, cdTotalSize);

  return fullZip;
}

/**
 * Utility to craft a mock ZIP archive buffer containing only Local File Headers (no EOCD).
 */
function createMockZipWithLFH(
  entries: Array<{
    filename: string;
    compressedSize: number;
    uncompressedSize: number;
  }>
): Uint8Array {
  const encoder = new TextEncoder();
  const lfhBuffers: Uint8Array[] = [];

  for (const entry of entries) {
    const filenameBytes = encoder.encode(entry.filename);
    const buf = new Uint8Array(30 + filenameBytes.length + entry.compressedSize);
    const view = new DataView(buf.buffer);

    view.setUint32(0, 0x04034b50, true); // Local file header signature
    view.setUint16(4, 20, true); // Version needed
    view.setUint16(6, 0, true); // Flags
    view.setUint16(8, 8, true); // Method
    view.setUint16(10, 0, true); // Time
    view.setUint16(12, 0, true); // Date
    view.setUint32(14, 0x12345678, true); // CRC
    view.setUint32(18, entry.compressedSize, true); // Compressed size
    view.setUint32(22, entry.uncompressedSize, true); // Uncompressed size
    view.setUint16(26, filenameBytes.length, true); // Filename length
    view.setUint16(28, 0, true); // Extra length

    buf.set(filenameBytes, 30);
    lfhBuffers.push(buf);
  }

  const totalSize = lfhBuffers.reduce((sum, b) => sum + b.length, 0);
  const out = new Uint8Array(totalSize);
  let offset = 0;
  for (const b of lfhBuffers) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

describe('Adversarial Red-Team Suite: Phase 1 Ingest & Normalise Engine', () => {
  // =========================================================================
  // ATTACK VECTOR 1: Zip Bomb Variants & Decompression Limits
  // =========================================================================
  describe('Vector 1: Zip Bomb Variants & Crafted Headers', () => {
    it('ADV-V1-01: Rejects zero-compressed size decompression bomb (compressedSize === 0, uncompressedSize > 0)', () => {
      const zip = createMockZipWithCD([
        {
          filename: 'xl/worksheets/sheet1.xml',
          compressedSize: 0,
          uncompressedSize: 150 * 1024 * 1024, // 150MB uncompressed from 0 compressed bytes!
        },
      ]);

      expect(() => inspectZipArchive(zip)).toThrow(ZipBombError);
    });

    it('ADV-V1-02: Exposes bypass of entry-level ratio check for high ratios under 1MB threshold', () => {
      // Craft an entry declaring 1 compressed byte and 1,000,000 uncompressed bytes.
      // Ratio is 1,000,000:1 (10,000x above MAX_COMPRESSION_RATIO of 100:1).
      // But inspectZipArchive line 120 requires `uncompressedSize > 1024 * 1024` (1MB).
      // Since 1,000,000 <= 1,048,576, the entry-level check is completely bypassed!
      const zip = createMockZipWithLFH([
        {
          filename: 'xl/media/image1.png',
          compressedSize: 1,
          uncompressedSize: 1_000_000,
        },
      ]);

      // Although the entry ratio is 1,000,000:1, the entry check doesn't trigger on its own.
      // Total ratio check does catch it if totalCompressedSize > 0:
      expect(() => inspectZipArchive(zip)).toThrow(ZipBombError);
    });

    it('ADV-V1-03: Rejects archives exceeding total uncompressed size limit of 200MB', () => {
      const zip = createMockZipWithCD([
        {
          filename: 'xl/worksheets/sheet1.xml',
          compressedSize: 10 * 1024 * 1024,
          uncompressedSize: 120 * 1024 * 1024,
        },
        {
          filename: 'xl/worksheets/sheet2.xml',
          compressedSize: 10 * 1024 * 1024,
          uncompressedSize: 120 * 1024 * 1024,
        },
      ]);

      // Total uncompressed is 240MB > MAX_UNCOMPRESSED_BYTES (200MB)
      expect(() => inspectZipArchive(zip)).toThrow(ZipBombError);
    });

    it('ADV-V1-04: Rejects ZIP64 archives declaring 0xFFFF count or 0xFFFFFFFF offset', () => {
      const zipWithZip64Count = createMockZipWithCD([], { overrideCdCount: 0xffff });
      expect(() => inspectZipArchive(zipWithZip64Count)).toThrow(ZipBombError);

      const zipWithZip64Offset = createMockZipWithCD([], { overrideCdOffset: 0xffffffff });
      expect(() => inspectZipArchive(zipWithZip64Offset)).toThrow(ZipBombError);
    });

    it('ADV-V1-05: Exposes desync between Central Directory and Local File Headers', () => {
      // An attacker can construct a ZIP where the Central Directory only lists harmless files,
      // but the Local File Headers contain a hostile uninspected component (e.g. vbaProject.bin).
      // inspectZipArchive only checks Central Directory if EOCD is found, missing LFH contents.
      const harmlessEntry = {
        filename: 'xl/workbook.xml',
        compressedSize: 50,
        uncompressedSize: 100,
      };

      const zip = createMockZipWithCD([harmlessEntry]);
      const inspection = inspectZipArchive(zip);
      expect(inspection.entries.map((e) => e.filename)).toContain('xl/workbook.xml');
    });
  });

  // =========================================================================
  // ATTACK VECTOR 2: Malformed / Corrupted Binary Streams & Magic Byte Guard Bypasses
  // =========================================================================
  describe('Vector 2: Malformed / Corrupted Binary Streams & Magic Byte Bypasses', () => {
    it('ADV-V2-01: Exposes extension spoofing: .xlsx file containing CSV text bypasses magic byte check', () => {
      // When a file is named 'data.xlsx' but contains text CSV data:
      // In validateUploadGuards, isZip is false, isOle is false, isLikelyBinary is false.
      // detectDelimitedTextType falls through and classifies it as 'csv'!
      // No MagicBytesMismatchError is thrown despite the .xlsx extension mismatch!
      const csvContent = new TextEncoder().encode('id,name,value\n1,Alice,100\n2,Bob,200');
      const result = validateUploadGuards(csvContent, 'data.xlsx');

      // The guard fails to reject the mismatched extension, silently reclassifying it as 'csv'
      expect(result.fileType).toBe('csv');
    });

    it('ADV-V2-02: Fails closed on corrupted Central Directory entry signature', () => {
      const corruptedCDZip = createMockZipWithCD(
        [
          {
            filename: 'test.xml',
            compressedSize: 10,
            uncompressedSize: 20,
          },
        ],
        { customCdSig: 0x99999999 } // Invalid signature!
      );

      expect(() => inspectZipArchive(corruptedCDZip)).toThrow();
    });

    it('ADV-V2-03: Fails closed on truncated ZIP buffers smaller than 22 bytes', () => {
      const truncated = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02]);
      expect(() => inspectZipArchive(truncated)).toThrow(CorruptedFileError);
    });

    it('ADV-V2-04: Fails closed on Central Directory offset out of bounds', () => {
      const outOfBoundsZip = createMockZipWithCD([], { overrideCdOffset: 99999 });
      expect(() => inspectZipArchive(outOfBoundsZip)).toThrow(CorruptedFileError);
    });

    it('ADV-V2-05: Fails closed on 0-byte upload and exceeds MAX_FILE_SIZE_BYTES (10MB)', () => {
      expect(() => validateUploadGuards(new Uint8Array(0), 'empty.xlsx')).toThrow(
        FileSizeLimitError
      );

      const oversized = new Uint8Array(MAX_FILE_SIZE_BYTES + 1);
      expect(() => validateUploadGuards(oversized, 'huge.xlsx')).toThrow(FileSizeLimitError);
    });

    it('ADV-V2-06: Correctly rejects binary files (ELF, PDF, PNG, etc.) disguised as CSV', () => {
      // ELF binary header: \x7fELF
      const elfHeader = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01]);
      expect(() => validateUploadGuards(elfHeader, 'exploit.csv')).toThrow(
        MagicBytesMismatchError
      );

      // PDF header: %PDF
      const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
      expect(() => validateUploadGuards(pdfHeader, 'invoice.csv')).toThrow(
        MagicBytesMismatchError
      );
    });

    it('ADV-V2-07: Fails closed when ZIP binary is disguised with .csv extension', () => {
      const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      expect(() => validateUploadGuards(zipHeader, 'fake.csv')).toThrow(
        MagicBytesMismatchError
      );
    });
  });

  // =========================================================================
  // ATTACK VECTOR 3: Prototype Pollution Keys in Sheet Names, Headers, and Cells
  // =========================================================================
  describe('Vector 3: Prototype Pollution Keys in Sheet Names, Headers, & Cells', () => {
    it('ADV-V3-01: Sanitizes prototype pollution keywords in SheetModel.name (__proto__, constructor)', () => {
      const rawSheet = {
        name: '__proto__',
        grid: [
          ['col_a', 'col_b'],
          ['val1', 'val2'],
        ],
        merges: [],
      };

      const sheetModel = normaliseSheet(rawSheet, 0);
      expect(sheetModel.name).toBe('safe___proto__');
    });

    it('ADV-V3-02: Exposes data loss when sheet name in SheetJS workbook matches Object.prototype property (constructor)', () => {
      // In sheetjs.ts line 73: `const ws = workbook.Sheets[sheetName];`
      // If workbook.SheetNames contains 'constructor', `workbook.Sheets['constructor']`
      // evaluates to Object.prototype.constructor (the Object function) instead of undefined or a worksheet!
      // Object['!ref'] is undefined, so the sheet grid is dropped and returned as empty!
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['HeaderA', 'HeaderB'],
        ['Val1', 'Val2'],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'constructor');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const raw = parseSheetJs(new Uint8Array(buf), 'test.xlsx', 'xlsx');
      const sheet = raw.sheets[0];
      // When sheetName is 'constructor', cell data could be misinterpreted or shadowed
      expect(sheet).toBeDefined();
    });

    it('ADV-V3-03: Gracefully handles cell value with Object.create(null) without throwing', () => {
      const rawSheet = {
        name: 'NullProtoSafe',
        grid: [
          ['Col1', Object.create(null)],
          ['Val1', 'Val2'],
        ],
        merges: [],
      };

      expect(() => detectHeaderRow(rawSheet.grid)).not.toThrow();
    });

    it('ADV-V3-04: Successfully sanitizes prototype pollution keywords in column headers', () => {
      const headers = ['__proto__', 'constructor', 'prototype', '__PROTO__', 'CONSTRUCTOR'];
      const sanitized = sanitiseHeaders(headers);

      expect(sanitized).toEqual([
        'safe___proto__',
        'safe_constructor',
        'safe_prototype',
        'safe___proto___1',
        'safe_constructor_1',
      ]);
    });

    it('ADV-V3-05: Handles object keys with toString / valueOf / isPrototypeOf safely', () => {
      const headers = ['toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf'];
      const sanitized = sanitiseHeaders(headers);

      expect(sanitized).toEqual([
        'to_string',
        'value_of',
        'has_own_property',
        'is_prototype_of',
      ]);
    });
  });

  // =========================================================================
  // ATTACK VECTOR 4: Hostile Cell Strings & Formula Injection
  // =========================================================================
  describe('Vector 4: Hostile Cell Strings & Formula Injection Neutralization', () => {
    it('ADV-V4-01: Exposes unneutralized formula injection strings in SheetModel.rows data', () => {
      // In normaliseCellValue (packages/engine/src/normalise/cell.ts):
      // Dangerous spreadsheet formula triggers (=, +, -, @, \t, \r, \n, |) are returned as raw strings.
      // They are stored directly into SheetModel.rows without neutralization.
      // If downstream processes pass row values to SampleValueSchema, validation fails!
      const hostileFormulas = [
        "=cmd|'/C calc'!A0",
        '+HYPERLINK("http://attacker.com")',
        '-2+3+cmd',
        '@SUM(1+1)',
        '\t=calc',
        '\n=1+1',
        "|cmd|'/C calc'!A0",
      ];

      const rawSheet = {
        name: 'FormulaInjection',
        grid: [
          ['FormulaCol'],
          ...hostileFormulas.map((formula) => [formula]),
        ],
        merges: [],
      };

      const sheetModel = normaliseSheet(rawSheet, 0);

      // Verify that normaliseSheet stored the raw formula strings unescaped (with whitespace trimmed)
      for (let i = 0; i < hostileFormulas.length; i++) {
        const rowVal = sheetModel.rows[i]?.['formula_col'];
        expect(rowVal).toBe(hostileFormulas[i]?.trim());

        // Passing this formula string to contracts' SampleValueSchema fails
        expect(() => SampleValueSchema.parse(rowVal)).toThrow();
      }
    });

    it('ADV-V4-02: Exposes raw unescaped formula strings in HeaderMetadata.originalHeaders', () => {
      // In detectHeaderRow and ColumnMetadata:
      // originalHeaders stores the exact raw string: "=cmd|'/C calc'!A0".
      // If UI or CSV export uses originalHeaders without single-quote prepending, formula executes!
      const rawSheet = {
        name: 'HeaderFormulas',
        grid: [
          ["=cmd|'/C calc'!A0", '+FOO', '@DDE("cmd")'],
          [100, 200, 300],
        ],
        merges: [],
      };

      const sheetModel = normaliseSheet(rawSheet, 0);

      // originalHeaders contains the raw hostile strings
      expect(sheetModel.headers.originalHeaders[0]).toBe("=cmd|'/C calc'!A0");
      expect(sheetModel.headers.originalHeaders[1]).toBe('+FOO');
      expect(sheetModel.headers.originalHeaders[2]).toBe('@DDE("cmd")');

      // However, sanitizedKeys are safely converted to programmatic identifiers:
      expect(sheetModel.headers.sanitizedKeys[0]).toBe('_cmd_c_calc_a0');
      expect(sheetModel.headers.sanitizedKeys[1]).toBe('_foo');
      expect(sheetModel.headers.sanitizedKeys[2]).toBe('_dde_cmd');
    });

    it('ADV-V4-03: Formula injection in CSV files never evaluates formulas during SheetJS parsing', async () => {
      // When a CSV with formula injections is ingested, SheetJS must not evaluate formulas
      const csv = 'col1,col2\n=cmd|\'/C calc\'!A0,123\n@SUM(1+1),456';
      const buf = new TextEncoder().encode(csv);

      const model = await ingestWorkbook(buf, { filename: 'hostile.csv' });
      const row0 = model.sheets[0]?.rows[0];
      const row1 = model.sheets[0]?.rows[1];

      // Values are read literally, never executed
      expect(row0?.['col1']).toBe("=cmd|'/C calc'!A0");
      expect(row1?.['col1']).toBe('@SUM(1+1)');
    });

    it('ADV-V4-04: Demonstrates that numeric formula headers (+100, -50) affect header detection scoring', () => {
      // Header detection checks: `typeof val === 'string' && Number.isNaN(Number(str))`
      // A header like "+100" or "-50" is a string, but Number("+100") is 100 (not NaN).
      // So stringRatio is 0 for purely numeric-formula headers!
      const res = detectHeaderRow([
        ['+100', '-50', '+200'],
        ['Alice', 'Bob', 'Charlie'],
      ]);

      // Row 0 had stringCount = 0 because all were parseable as numbers,
      // so Row 1 (actual data!) scored higher as headers!
      expect(res.detectedRowIndex).toBe(1);
    });
  });

  // =========================================================================
  // ATTACK VECTOR 5: Pathological Grids & Boundary Exhaustion
  // =========================================================================
  describe('Vector 5: Pathological Grids & Boundary Exhaustion', () => {
    it('ADV-V5-01: Successfully handles pathological 0x0 empty grid and 1x0 grid', () => {
      const emptySheet = {
        name: 'EmptyGrid',
        grid: [],
        merges: [],
      };

      const model = normaliseSheet(emptySheet, 0);
      expect(model.rowCount).toBe(0);
      expect(model.columnCount).toBe(1); // Defaults to Column 1
      expect(model.columns[0]?.key).toBe('column_1');

      const singleEmptyRow = {
        name: 'SingleEmptyRow',
        grid: [[]],
        merges: [],
      };
      const model2 = normaliseSheet(singleEmptyRow, 0);
      expect(model2.rowCount).toBe(0);
      expect(model2.columnCount).toBe(1);
    });

    it('ADV-V5-02: Exposes header detection blind spot when header row is beyond row 20', () => {
      // In detectHeaderRow: `const maxCandidateRow = Math.min(20, grid.length - 1);`
      // If a spreadsheet has 25 leading blank / metadata rows before the true table header:
      // detectHeaderRow stops scanning at row 20, defaults to row 0, and pushes true headers into data!
      const grid: unknown[][] = [];
      for (let i = 0; i < 25; i++) {
        grid.push([null, null]); // 25 empty spacer rows
      }
      grid.push(['RealHeader1', 'RealHeader2']); // Row 25
      grid.push(['Data1', 'Data2']); // Row 26

      const headerResult = detectHeaderRow(grid);

      // Limitation: detectHeaderRow misses row 25 entirely because it only evaluates up to row 20!
      expect(headerResult.detectedRowIndex).toBe(0);
      expect(headerResult.originalHeaders).toEqual(['Column 1', 'Column 2']);
    });

    it('ADV-V5-03: Safely strips 10,000 trailing blank rows without memory exhaustion', () => {
      const rows: unknown[][] = [];
      for (let i = 0; i < 100; i++) {
        rows.push([`row_${i}`, i * 10]);
      }
      for (let i = 0; i < 10000; i++) {
        rows.push([null, null]);
      }

      const clean = removeNoiseRows(rows, 2);
      expect(clean).toHaveLength(100);
    });

    it('ADV-V5-04: Forward-fills inverted coordinates and out-of-bounds merge ranges safely', () => {
      const grid = [
        ['A', 'B', 'C'],
        ['D', 'E', 'F'],
      ];

      // Inverted merge: endRow < startRow, endCol < startCol
      const invertedMerge = [
        { startRow: 1, startCol: 2, endRow: 0, endCol: 0 },
        { startRow: 10, startCol: 10, endRow: 20, endCol: 20 }, // completely out of bounds
      ];

      const filled = applyMergeForwardFill(grid, invertedMerge);
      expect(filled).toEqual([
        ['A', 'B', 'C'],
        ['D', 'E', 'F'],
      ]);
    });

    it('ADV-V5-05: Normalizes non-ASCII, emoji, and special symbol headers into valid SafeIdentifiers', () => {
      const headers = ['姓名', 'Age (yrs)', 'Total $', '🔥 Hot Deals', 'R&D Budget', 'äöü'];
      const sanitized = sanitiseHeaders(headers);

      // Non-ASCII characters are replaced with underscores per SafeIdentifier rules
      expect(sanitized).toEqual([
        'col_1',
        'age_yrs',
        'total',
        '_hot_deals',
        'r_d_budget',
        'col_6',
      ]);
    });
  });

  // =========================================================================
  // ATTACK VECTOR 6: Macro Workbooks Disguised as .xlsx or Plain CSV
  // =========================================================================
  describe('Vector 6: Macro Workbooks Disguised as .xlsx or Plain CSV', () => {
    it('ADV-V6-01: Rejects macro inspection bypass via Windows backslash path separator (xl\\macros\\sheet1.bin)', () => {
      const zip = createMockZipWithCD([
        {
          filename: 'xl\\macros\\sheet1.bin', // Backslash path separator!
          compressedSize: 100,
          uncompressedSize: 500,
        },
      ]);

      expect(() => inspectZipArchive(zip)).toThrow(MacroNotAllowedError);
    });

    it('ADV-V6-02: Rejects Excel 4.0 XLM Macro sheet (xl/macroSheets/sheet1.xml)', () => {
      const zip = createMockZipWithCD([
        {
          filename: 'xl/macroSheets/sheet1.xml', // Excel 4.0 XLM macro sheet!
          compressedSize: 100,
          uncompressedSize: 500,
        },
      ]);

      expect(() => inspectZipArchive(zip)).toThrow(MacroNotAllowedError);
    });

    it('ADV-V6-03: Exposes missing VBA macro inspection in legacy OLE (.xls) workbooks', () => {
      // validateUploadGuards checks isOle:
      // lines 78-88 return { fileType: 'xls', byteLength: ... } without ANY macro inspection!
      // In contrast to ZIP/XLSX which runs inspectZipArchive, legacy OLE .xls files are never inspected for VBA macros!
      const oleHeader = new Uint8Array([
        0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, // OLE magic bytes
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);

      const result = validateUploadGuards(oleHeader, 'legacy_macro_payload.xls');
      // Legacy OLE file with potential embedded macros passes upload guards unchecked
      expect(result.fileType).toBe('xls');
    });

    it('ADV-V6-04: Fails closed on macro extensions (.xlsm, .xlsb, .xltm, .xlam, .xlm, .xla)', () => {
      const dummy = new Uint8Array(100);
      expect(() => validateUploadGuards(dummy, 'report.xlsm')).toThrow(MacroNotAllowedError);
      expect(() => validateUploadGuards(dummy, 'report.xlsb')).toThrow(MacroNotAllowedError);
      expect(() => validateUploadGuards(dummy, 'report.xltm')).toThrow(MacroNotAllowedError);
      expect(() => validateUploadGuards(dummy, 'report.xlam')).toThrow(MacroNotAllowedError);
      expect(() => validateUploadGuards(dummy, 'report.xlm')).toThrow(MacroNotAllowedError);
      expect(() => validateUploadGuards(dummy, 'report.xla')).toThrow(MacroNotAllowedError);
    });

    it('ADV-V6-05: Rejects standard VBA macro component in XLSX archive (vbaProject.bin)', () => {
      const zip = createMockZipWithCD([
        {
          filename: 'xl/vbaProject.bin',
          compressedSize: 100,
          uncompressedSize: 500,
        },
      ]);

      expect(() => inspectZipArchive(zip)).toThrow(MacroNotAllowedError);
    });
  });
});
