import { MAX_FILE_SIZE_BYTES, type FileType } from '@unsheet/contracts';
import {
  FileSizeLimitError,
  MagicBytesMismatchError,
  MacroNotAllowedError,
} from './errors.js';
import { inspectZipArchive } from './zip.js';

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const ZIP_EMPTY_MAGIC = [0x50, 0x4b, 0x05, 0x06];
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const UTF8_BOM = [0xef, 0xbb, 0xbf];
const UTF16_LE_BOM = [0xff, 0xfe];
const UTF16_BE_BOM = [0xfe, 0xff];

const MACRO_EXTENSIONS = new Set(['xlsm', 'xlsb', 'xltm', 'xlam']);

export interface GuardValidationResult {
  fileType: FileType;
  byteLength: number;
}

/**
 * Validates file size, file extensions, magic bytes, and inspects ZIP archives for zip bombs and macros.
 */
export function validateUploadGuards(
  buffer: Uint8Array,
  filename?: string
): GuardValidationResult {
  // 1. File size checks
  if (buffer.byteLength === 0) {
    throw new FileSizeLimitError('File is empty (0 bytes)');
  }

  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new FileSizeLimitError(
      `File size (${buffer.byteLength} bytes) exceeds maximum allowed size of 10MB (${MAX_FILE_SIZE_BYTES} bytes)`
    );
  }

  // 2. Filename extension checks
  let extension = '';
  if (filename) {
    const parts = filename.split('.');
    const lastPart = parts[parts.length - 1];
    if (lastPart !== undefined) {
      extension = lastPart.toLowerCase().trim();
    }
    if (MACRO_EXTENSIONS.has(extension)) {
      throw new MacroNotAllowedError(
        `Macro-enabled workbook format (.${extension}) is strictly prohibited`
      );
    }
  }

  // 3. Magic bytes validation
  const isZip =
    matchesBytes(buffer, ZIP_MAGIC) || matchesBytes(buffer, ZIP_EMPTY_MAGIC);
  const isOle = matchesBytes(buffer, OLE_MAGIC);

  if (isZip) {
    // If extension explicitly claims CSV/TSV but content is a ZIP file
    if (extension === 'csv' || extension === 'tsv') {
      throw new MagicBytesMismatchError(
        `File with .${extension} extension contains ZIP/XLSX binary data`
      );
    }

    // Inspect zip contents (checks compression ratio, total size, macro entries)
    inspectZipArchive(buffer);

    return {
      fileType: 'xlsx',
      byteLength: buffer.byteLength,
    };
  }

  if (isOle) {
    if (extension === 'csv' || extension === 'tsv') {
      throw new MagicBytesMismatchError(
        `File with .${extension} extension contains legacy OLE/XLS binary data`
      );
    }
    return {
      fileType: 'xls',
      byteLength: buffer.byteLength,
    };
  }

  // 4. CSV / TSV text validation
  if (isLikelyBinary(buffer)) {
    throw new MagicBytesMismatchError(
      'Binary file format not recognized. Supported formats are XLSX, XLS, CSV, and TSV'
    );
  }

  // Determine whether CSV or TSV
  const fileType = detectDelimitedTextType(buffer, extension);

  return {
    fileType,
    byteLength: buffer.byteLength,
  };
}

function matchesBytes(buffer: Uint8Array, magic: number[]): boolean {
  if (buffer.byteLength < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) return false;
  }
  return true;
}

/**
 * Checks if the buffer contains binary headers (ELF, Mach-O, PDF, images)
 * or embedded null bytes in the probed text chunk.
 */
function isLikelyBinary(buffer: Uint8Array): boolean {
  // Check known non-spreadsheet binary magic bytes
  if (buffer.byteLength >= 4) {
    // ELF executable: \x7fELF
    if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
      return true;
    }
    // PDF: %PDF
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return true;
    }
    // Windows PE / DOS: MZ
    if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
      return true;
    }
    // PNG: \x89PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return true;
    }
    // GIF: GIF8
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return true;
    }
  }

  // Check for UTF BOMs
  let offset = 0;
  if (matchesBytes(buffer, UTF8_BOM)) {
    offset = 3;
  } else if (matchesBytes(buffer, UTF16_LE_BOM) || matchesBytes(buffer, UTF16_BE_BOM)) {
    // UTF-16 text is acceptable
    return false;
  }

  // Probe up to 4KB for null bytes or excessive non-text control characters
  const probeLength = Math.min(buffer.byteLength, 4096);
  let controlChars = 0;

  for (let i = offset; i < probeLength; i++) {
    const byte = buffer[i];
    if (byte === undefined) continue;
    if (byte === 0x00) {
      return true; // Null bytes never valid in clean CSV/TSV
    }
    // Control characters other than TAB (0x09), LF (0x0A), CR (0x0D)
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) {
      controlChars++;
    }
  }

  // If >10% of characters are non-printable control characters, treat as binary
  return controlChars > (probeLength - offset) * 0.1;
}

function detectDelimitedTextType(buffer: Uint8Array, extension: string): 'csv' | 'tsv' {
  if (extension === 'tsv') return 'tsv';
  if (extension === 'csv') return 'csv';

  // Probe text to count commas vs tabs
  const probeLength = Math.min(buffer.byteLength, 4096);
  let commaCount = 0;
  let tabCount = 0;

  for (let i = 0; i < probeLength; i++) {
    if (buffer[i] === 0x2c) commaCount++;
    if (buffer[i] === 0x09) tabCount++;
  }

  return tabCount > commaCount ? 'tsv' : 'csv';
}
