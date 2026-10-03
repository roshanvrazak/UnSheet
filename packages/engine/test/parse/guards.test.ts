import { describe, it, expect } from 'vitest';
import {
  validateUploadGuards,
  FileSizeLimitError,
  MagicBytesMismatchError,
  MacroNotAllowedError,
} from '../../src/parse/index.js';

describe('Upload Guards', () => {
  it('rejects empty (0 byte) files', () => {
    const empty = new Uint8Array(0);
    expect(() => validateUploadGuards(empty, 'test.csv')).toThrow(FileSizeLimitError);
  });

  it('rejects files exceeding MAX_FILE_SIZE_BYTES (10MB)', () => {
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    expect(() => validateUploadGuards(oversized, 'large.csv')).toThrow(FileSizeLimitError);
  });

  it('accepts files within the 10MB limit', () => {
    const validCsv = new TextEncoder().encode('id,name,value\n1,Alice,100\n2,Bob,200\n');
    const result = validateUploadGuards(validCsv, 'data.csv');
    expect(result.fileType).toBe('csv');
    expect(result.byteLength).toBe(validCsv.byteLength);
  });

  it('rejects macro-enabled workbook extensions (.xlsm, .xlsb, .xltm, .xlam)', () => {
    const dummy = new Uint8Array(100);
    expect(() => validateUploadGuards(dummy, 'malicious.xlsm')).toThrow(MacroNotAllowedError);
    expect(() => validateUploadGuards(dummy, 'malicious.XLSB')).toThrow(MacroNotAllowedError);
    expect(() => validateUploadGuards(dummy, 'template.xltm')).toThrow(MacroNotAllowedError);
    expect(() => validateUploadGuards(dummy, 'addin.xlam')).toThrow(MacroNotAllowedError);
  });

  it('validates CSV and TSV text formats', () => {
    const csvData = new TextEncoder().encode('colA,colB\n1,2\n');
    expect(validateUploadGuards(csvData, 'test.csv').fileType).toBe('csv');

    const tsvData = new TextEncoder().encode('colA\tcolB\n1\t2\n');
    expect(validateUploadGuards(tsvData, 'test.tsv').fileType).toBe('tsv');
  });

  it('accepts UTF-8 with BOM for CSV', () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const text = new TextEncoder().encode('name,age\nAlice,30\n');
    const combined = new Uint8Array(bom.length + text.length);
    combined.set(bom, 0);
    combined.set(text, bom.length);

    const result = validateUploadGuards(combined, 'data.csv');
    expect(result.fileType).toBe('csv');
  });

  it('rejects binary files masquerading as CSV when null bytes are detected', () => {
    const binaryData = new Uint8Array([0x61, 0x62, 0x00, 0x63, 0x64]); // "ab\0cd"
    expect(() => validateUploadGuards(binaryData, 'fake.csv')).toThrow(MagicBytesMismatchError);
  });

  it('rejects non-spreadsheet binary formats (ELF, PE, PDF, PNG)', () => {
    const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x01, 0x01, 0x01, 0x00]);
    expect(() => validateUploadGuards(elf, 'binary.csv')).toThrow(MagicBytesMismatchError);

    const pe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // MZ
    expect(() => validateUploadGuards(pe, 'app.csv')).toThrow(MagicBytesMismatchError);

    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    expect(() => validateUploadGuards(pdf, 'doc.csv')).toThrow(MagicBytesMismatchError);

    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]); // \x89PNG
    expect(() => validateUploadGuards(png, 'image.csv')).toThrow(MagicBytesMismatchError);
  });

  it('rejects ZIP magic bytes when filename claims to be CSV', () => {
    const fakeCsvWithZipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(() => validateUploadGuards(fakeCsvWithZipMagic, 'sneaky.csv')).toThrow(
      MagicBytesMismatchError
    );
  });

  it('rejects OLE magic bytes when filename claims to be CSV', () => {
    const fakeCsvWithOleMagic = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ]);
    expect(() => validateUploadGuards(fakeCsvWithOleMagic, 'sneaky.csv')).toThrow(
      MagicBytesMismatchError
    );
  });
});
