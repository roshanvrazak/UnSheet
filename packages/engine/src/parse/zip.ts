import { MAX_UNCOMPRESSED_BYTES } from '@unsheet/contracts';
import {
  MacroNotAllowedError,
  ZipBombError,
  CorruptedFileError,
  UploadGuardError,
} from './errors.js';

export const MAX_COMPRESSION_RATIO = 100;

export interface ZipEntryInfo {
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
}

export interface ZipInspectionResult {
  entries: ZipEntryInfo[];
  totalCompressedSize: number;
  totalUncompressedSize: number;
  compressionRatio: number;
}

const MACRO_ENTRY_PATTERNS = [
  /vbaproject\.bin$/i,
  /vbaprojectsignature\.bin$/i,
  /xl\/(?:macros|macroSheets)\//i,
  /macroSheet/i,
  /macroenabled/i,
  /xl\/workbook\.bin$/i,
];

/**
 * Pure TypeScript ZIP inspector.
 * Inspects ZIP headers (Central Directory & Local Headers) without decompression
 * to enforce zip-bomb mitigations and macro prohibitions.
 */
export function inspectZipArchive(buffer: Uint8Array): ZipInspectionResult {
  if (buffer.byteLength < 22) {
    throw new CorruptedFileError('File buffer too small for a valid ZIP archive');
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // 1. Search for End of Central Directory (EOCD) signature: 0x06054b50 ("PK\x05\x06")
  let eocdOffset = -1;
  const maxSearchLength = Math.min(buffer.byteLength, 65557);
  const minOffset = buffer.byteLength - maxSearchLength;

  for (let i = buffer.byteLength - 22; i >= minOffset; i--) {
    if (
      buffer[i] === 0x50 &&
      buffer[i + 1] === 0x4b &&
      buffer[i + 2] === 0x05 &&
      buffer[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }

  const entries: ZipEntryInfo[] = [];
  let totalCompressedSize = 0;
  let totalUncompressedSize = 0;

  if (eocdOffset !== -1) {
    const cdCount = view.getUint16(eocdOffset + 10, true);
    const cdSize = view.getUint32(eocdOffset + 12, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);

    // ZIP64 check or offset sanity
    if (cdCount === 0xffff || cdOffset === 0xffffffff) {
      throw new ZipBombError('ZIP64 archives exceeding standard bounds are not permitted');
    }

    if (cdOffset + cdSize > buffer.byteLength) {
      throw new CorruptedFileError('ZIP Central Directory offset out of bounds');
    }

    let cursor = cdOffset;
    const cdEnd = cdOffset + cdSize;
    const decoder = new TextDecoder('utf-8', { fatal: false });

    while (cursor < cdEnd) {
      if (cursor + 46 > buffer.byteLength) {
        throw new CorruptedFileError('Truncated ZIP Central Directory header');
      }

      const sig = view.getUint32(cursor, true);
      if (sig !== 0x02014b50) {
        // SEC-P1-07 / ADV-P1-11: Fail closed on corrupted Central Directory entry signature
        throw new UploadGuardError(
          `Corrupted Central Directory entry signature (0x${sig.toString(16)}) at offset ${cursor}`
        );
      }

      const compressedSize = view.getUint32(cursor + 20, true);
      const uncompressedSize = view.getUint32(cursor + 24, true);
      const filenameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);

      if (cursor + 46 + filenameLength > buffer.byteLength) {
        throw new CorruptedFileError('Truncated ZIP filename entry');
      }

      const filenameBytes = buffer.subarray(cursor + 46, cursor + 46 + filenameLength);
      const rawFilename = decoder.decode(filenameBytes);
      // Normalize backslashes for cross-platform security checking
      const filename = rawFilename.replace(/\\/g, '/');

      // SEC-P1-02 / ADV-P1-04: Catch zero compressed bytes expanding into non-zero uncompressed size
      if (uncompressedSize > 0 && compressedSize === 0) {
        throw new ZipBombError(
          `Entry "${filename}" specifies 0 compressed bytes with non-zero uncompressed size (${uncompressedSize} bytes)`
        );
      }

      // Check for macros
      for (const pattern of MACRO_ENTRY_PATTERNS) {
        if (pattern.test(filename)) {
          throw new MacroNotAllowedError(
            `Macro-enabled component detected in workbook: ${filename}`
          );
        }
      }

      // Check uncompressed size
      if (uncompressedSize > MAX_UNCOMPRESSED_BYTES) {
        throw new ZipBombError(
          `Entry "${filename}" exceeds maximum uncompressed size of 200MB`
        );
      }

      // Entry-level compression ratio check (for entries > 1MB)
      if (compressedSize > 0) {
        const ratio = uncompressedSize / compressedSize;
        if (ratio > MAX_COMPRESSION_RATIO && uncompressedSize > 1024 * 1024) {
          throw new ZipBombError(
            `Entry "${filename}" compression ratio (${ratio.toFixed(1)}:1) exceeds 100:1 limit`
          );
        }
      }

      totalCompressedSize += compressedSize;
      totalUncompressedSize += uncompressedSize;

      if (totalUncompressedSize > MAX_UNCOMPRESSED_BYTES) {
        throw new ZipBombError(
          `Total uncompressed ZIP size (${totalUncompressedSize} bytes) exceeds 200MB limit`
        );
      }

      entries.push({ filename, compressedSize, uncompressedSize });
      cursor += 46 + filenameLength + extraLength + commentLength;
    }
  } else {
    // Fallback: Scan Local File Headers ("PK\x03\x04")
    let cursor = 0;
    const decoder = new TextDecoder('utf-8', { fatal: false });

    while (cursor + 30 <= buffer.byteLength) {
      const sig = view.getUint32(cursor, true);
      if (sig !== 0x04034b50) {
        break;
      }

      const compressedSize = view.getUint32(cursor + 18, true);
      const uncompressedSize = view.getUint32(cursor + 22, true);
      const filenameLength = view.getUint16(cursor + 26, true);
      const extraLength = view.getUint16(cursor + 28, true);

      if (cursor + 30 + filenameLength > buffer.byteLength) {
        throw new CorruptedFileError('Truncated ZIP local file header');
      }

      const filenameBytes = buffer.subarray(cursor + 30, cursor + 30 + filenameLength);
      const rawFilename = decoder.decode(filenameBytes);
      const filename = rawFilename.replace(/\\/g, '/');

      // SEC-P1-02: Zero compressed bytes with non-zero uncompressed size
      if (uncompressedSize > 0 && compressedSize === 0) {
        throw new ZipBombError(
          `Entry "${filename}" specifies 0 compressed bytes with non-zero uncompressed size (${uncompressedSize} bytes)`
        );
      }

      for (const pattern of MACRO_ENTRY_PATTERNS) {
        if (pattern.test(filename)) {
          throw new MacroNotAllowedError(
            `Macro-enabled component detected in workbook: ${filename}`
          );
        }
      }

      if (uncompressedSize > MAX_UNCOMPRESSED_BYTES) {
        throw new ZipBombError(
          `Entry "${filename}" exceeds maximum uncompressed size of 200MB`
        );
      }

      if (compressedSize > 0) {
        const ratio = uncompressedSize / compressedSize;
        if (ratio > MAX_COMPRESSION_RATIO && uncompressedSize > 1024 * 1024) {
          throw new ZipBombError(
            `Entry "${filename}" compression ratio exceeds 100:1 limit`
          );
        }
      }

      totalCompressedSize += compressedSize;
      totalUncompressedSize += uncompressedSize;

      if (totalUncompressedSize > MAX_UNCOMPRESSED_BYTES) {
        throw new ZipBombError(
          `Total uncompressed ZIP size exceeds 200MB limit`
        );
      }

      entries.push({ filename, compressedSize, uncompressedSize });

      const nextOffset = cursor + 30 + filenameLength + extraLength + compressedSize;
      if (nextOffset <= cursor) {
        break;
      }
      cursor = nextOffset;
    }
  }

  // SEC-P1-02: Total uncompressed > 0 with total compressed === 0
  if (totalUncompressedSize > 0 && totalCompressedSize === 0) {
    throw new ZipBombError(
      `ZIP archive specifies 0 compressed bytes with non-zero uncompressed size (${totalUncompressedSize} bytes)`
    );
  }

  // Check overall compression ratio
  const compressionRatio =
    totalCompressedSize > 0
      ? totalUncompressedSize / totalCompressedSize
      : 1;

  if (totalCompressedSize > 0 && compressionRatio > MAX_COMPRESSION_RATIO) {
    throw new ZipBombError(
      `ZIP overall compression ratio (${compressionRatio.toFixed(1)}:1) exceeds 100:1 limit`
    );
  }

  return {
    entries,
    totalCompressedSize,
    totalUncompressedSize,
    compressionRatio,
  };
}
