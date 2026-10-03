import { describe, it, expect } from 'vitest';
import {
  inspectZipArchive,
  ZipBombError,
  MacroNotAllowedError,
  CorruptedFileError,
} from '../../src/parse/index.js';

interface MockZipFileEntry {
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
  data?: Uint8Array;
}

function buildMockZip(entries: MockZipFileEntry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const localOffsets: number[] = [];
  let currentOffset = 0;

  // 1. Build Local File Headers
  for (const entry of entries) {
    localOffsets.push(currentOffset);
    const filenameBytes = new TextEncoder().encode(entry.filename);
    const dataBytes = entry.data ?? new Uint8Array(entry.compressedSize);

    const localHeader = new Uint8Array(30 + filenameBytes.length + dataBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true); // PK\x03\x04
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, 0, true);
    view.setUint32(18, entry.compressedSize, true);
    view.setUint32(22, entry.uncompressedSize, true);
    view.setUint16(26, filenameBytes.length, true);
    view.setUint16(28, 0, true);

    localHeader.set(filenameBytes, 30);
    localHeader.set(dataBytes, 30 + filenameBytes.length);

    parts.push(localHeader);
    currentOffset += localHeader.length;
  }

  // 2. Build Central Directory
  const cdOffset = currentOffset;
  let cdSize = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const localOffset = localOffsets[i]!;
    const filenameBytes = new TextEncoder().encode(entry.filename);

    const cdHeader = new Uint8Array(46 + filenameBytes.length);
    const view = new DataView(cdHeader.buffer);

    view.setUint32(0, 0x02014b50, true); // PK\x01\x02
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, 0, true);
    view.setUint32(20, entry.compressedSize, true);
    view.setUint32(24, entry.uncompressedSize, true);
    view.setUint16(28, filenameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, localOffset, true);

    cdHeader.set(filenameBytes, 46);
    parts.push(cdHeader);
    cdSize += cdHeader.length;
    currentOffset += cdHeader.length;
  }

  // 3. Build End of Central Directory (EOCD)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // PK\x05\x06
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, cdOffset, true);
  eocdView.setUint16(20, 0, true);

  parts.push(eocd);

  // Concatenate parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const finalZip = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of parts) {
    finalZip.set(part, pos);
    pos += part.length;
  }

  return finalZip;
}

describe('ZIP Security & Bomb Mitigations', () => {
  it('throws CorruptedFileError for buffers smaller than 22 bytes', () => {
    expect(() => inspectZipArchive(new Uint8Array(10))).toThrow(CorruptedFileError);
  });

  it('inspects valid ZIP archives and reports sizes and compression ratio', () => {
    const zip = buildMockZip([
      { filename: '[Content_Types].xml', compressedSize: 100, uncompressedSize: 500 },
      { filename: 'xl/workbook.xml', compressedSize: 200, uncompressedSize: 800 },
    ]);

    const result = inspectZipArchive(zip);
    expect(result.entries.length).toBe(2);
    expect(result.totalCompressedSize).toBe(300);
    expect(result.totalUncompressedSize).toBe(1300);
    expect(result.compressionRatio).toBeCloseTo(1300 / 300, 2);
  });

  it('rejects archives where single entry uncompressed size exceeds MAX_UNCOMPRESSED_BYTES (200MB)', () => {
    const bomb = buildMockZip([
      { filename: 'xl/hugeSheet.xml', compressedSize: 1000, uncompressedSize: 250 * 1024 * 1024 },
    ]);
    expect(() => inspectZipArchive(bomb)).toThrow(ZipBombError);
  });

  it('rejects archives where total uncompressed size exceeds 200MB', () => {
    const bomb = buildMockZip([
      { filename: 'xl/sheet1.xml', compressedSize: 500, uncompressedSize: 120 * 1024 * 1024 },
      { filename: 'xl/sheet2.xml', compressedSize: 500, uncompressedSize: 120 * 1024 * 1024 },
    ]);
    expect(() => inspectZipArchive(bomb)).toThrow(ZipBombError);
  });

  it('rejects archives with excessive entry compression ratio (> 100:1 for > 1MB entry)', () => {
    const bomb = buildMockZip([
      { filename: 'xl/sheet1.xml', compressedSize: 5000, uncompressedSize: 5 * 1024 * 1024 }, // 1000:1 ratio
    ]);
    expect(() => inspectZipArchive(bomb)).toThrow(ZipBombError);
  });

  it('rejects archives with excessive overall compression ratio (> 100:1)', () => {
    const bomb = buildMockZip([
      { filename: 'xl/sheet1.xml', compressedSize: 10, uncompressedSize: 2000 }, // 200:1 ratio
    ]);
    expect(() => inspectZipArchive(bomb)).toThrow(ZipBombError);
  });

  it('detects and rejects macro-enabled components inside ZIP (vbaProject.bin)', () => {
    const macroZip = buildMockZip([
      { filename: 'xl/workbook.xml', compressedSize: 100, uncompressedSize: 200 },
      { filename: 'xl/vbaProject.bin', compressedSize: 100, uncompressedSize: 200 },
    ]);
    expect(() => inspectZipArchive(macroZip)).toThrow(MacroNotAllowedError);
  });

  it('detects and rejects macro signatures (vbaProjectSignature.bin)', () => {
    const macroZip = buildMockZip([
      { filename: 'xl/vbaProjectSignature.bin', compressedSize: 50, uncompressedSize: 100 },
    ]);
    expect(() => inspectZipArchive(macroZip)).toThrow(MacroNotAllowedError);
  });

  it('rejects corrupted central directory offset', () => {
    const validZip = buildMockZip([
      { filename: 'test.xml', compressedSize: 10, uncompressedSize: 20 },
    ]);
    // Corrupt EOCD central directory offset (offset 16 from eocd end)
    const corrupted = new Uint8Array(validZip);
    const view = new DataView(corrupted.buffer);
    const eocdPos = corrupted.length - 22;
    view.setUint32(eocdPos + 16, 0x7fffffff, true); // Point way out of bounds

    expect(() => inspectZipArchive(corrupted)).toThrow(CorruptedFileError);
  });

  it('falls back to local file header scanning when EOCD is stripped', () => {
    const validZip = buildMockZip([
      { filename: 'xl/sheet1.xml', compressedSize: 20, uncompressedSize: 40 },
    ]);
    // Strip EOCD from end
    const stripped = validZip.subarray(0, validZip.length - 22);

    const result = inspectZipArchive(stripped);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0]?.filename).toBe('xl/sheet1.xml');
  });
});
