/**
 * Domain errors for file ingestion and parsing.
 */
export class IngestError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'IngestError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UploadGuardError extends IngestError {
  constructor(message = 'Upload guard validation failed') {
    super(message, 'UPLOAD_GUARD_FAILED');
    this.name = 'UploadGuardError';
  }
}

export class FileSizeLimitError extends IngestError {
  constructor(message = 'File size exceeds maximum 10MB limit') {
    super(message, 'FILE_SIZE_EXCEEDED');
    this.name = 'FileSizeLimitError';
  }
}

export class MagicBytesMismatchError extends IngestError {
  constructor(message = 'Invalid file format or magic bytes mismatch') {
    super(message, 'INVALID_MAGIC_BYTES');
    this.name = 'MagicBytesMismatchError';
  }
}

export class MacroNotAllowedError extends IngestError {
  constructor(message = 'Macro-enabled workbooks (.xlsm, .xlsb, VBA) are not permitted') {
    super(message, 'MACRO_NOT_ALLOWED');
    this.name = 'MacroNotAllowedError';
  }
}

export class ZipBombError extends IngestError {
  constructor(message = 'Decompression bomb or excessive compression ratio detected') {
    super(message, 'ZIP_BOMB_DETECTED');
    this.name = 'ZipBombError';
  }
}

export class SheetBoundsError extends IngestError {
  constructor(message = 'Sheet or workbook bounds exceeded') {
    super(message, 'BOUNDS_EXCEEDED');
    this.name = 'SheetBoundsError';
  }
}

export class CorruptedFileError extends IngestError {
  constructor(message = 'Failed to parse corrupted spreadsheet file') {
    super(message, 'CORRUPTED_FILE');
    this.name = 'CorruptedFileError';
  }
}
