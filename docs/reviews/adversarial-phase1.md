# Adversarial Red-Team Security Review: Phase 1 Ingest & Normalise Engine

**Date**: 2026-10-04  
**Target**: `@unsheet/engine` (`packages/engine/src/parse/**`, `packages/engine/src/normalise/**`, `packages/fixtures/**`)  
**Reviewer**: Adversarial QA & Red-Team Agent  
**Status**: Completed  
**Test Suite**: [`packages/engine/test/adversarial/adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/adversarial.test.ts) (31 tests passing)

---

## 1. Executive Summary

During Phase 1, we executed systematic adversarial red-teaming against `@unsheet/engine`'s ingest and normalisation subsystems. The target components encompass pure TypeScript ZIP archive inspection (`zip.ts`), upload security guards (`guards.ts`), headless SheetJS ingestion (`sheetjs.ts`), and table normalisation modules (`header.ts`, `sanitise.ts`, `cell.ts`, `merge.ts`, `noise.ts`, `sheet.ts`, `workbook.ts`).

The engine establishes solid baseline defenses:
- Upload size guards reject 0-byte and >10MB files.
- ZIP inspection enforces a 200MB uncompressed limit and flags standard ZIP64 descriptors (`0xFFFF`, `0xFFFFFFFF`).
- Column header sanitisation successfully renames canonical prototype keys (`__proto__`, `constructor`, `prototype` -> `safe___proto__`, etc.).
- SheetJS runs with `cellFormula: false`, preventing arbitrary formula evaluation during ingest.
- Noise filtering safely strips 10,000 trailing blank rows and handles inverted merge ranges without crashing.

However, comprehensive hostile probing across 6 attack vectors identified **12 security vulnerabilities, validation gaps, and denial-of-service vectors**. These include **macro detection bypasses via Windows backslashes and Excel 4.0 XLM macro sheets**, a **division-by-zero bypass in zip bomb ratio checks**, an **unhandled `TypeError` crash on null-prototype objects**, and **unconstrained prototype pollution in `SheetModel.name`**.

All 12 findings have been codified as automated test cases in [`packages/engine/test/adversarial/adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/adversarial.test.ts).

---

## 2. Vulnerability & Findings Matrix

| ID | Attack Vector | Severity | Vulnerability Description | Status |
|---|---|---|---|---|
| **ADV-P1-01** | Macro Detection Bypass | **HIGH** | Windows backslash path separator (`xl\macros\sheet1.bin`) bypasses `/xl\/macros\//i` regex | Exposed via Test |
| **ADV-P1-02** | Macro Detection Bypass | **HIGH** | Excel 4.0 XLM Macro sheets (`xl/macroSheets/sheet1.xml`) bypass `MACRO_ENTRY_PATTERNS` | Exposed via Test |
| **ADV-P1-03** | Macro Inspection Gap | **HIGH** | Legacy OLE/XLS (`.xls`) workbooks containing VBA macros pass upload guards without inspection | Exposed via Test |
| **ADV-P1-04** | Zip Bomb Bypass | **HIGH** | Zero compressed size (`compressedSize === 0, uncompressedSize > 0`) bypasses ratio checks | Exposed via Test |
| **ADV-P1-05** | Prototype Pollution | **MEDIUM** | `SheetModel.name` accepts `__proto__` and `constructor` without validation | Exposed via Test |
| **ADV-P1-06** | Data Loss / Hijacking | **MEDIUM** | Sheet named `constructor` or `toString` triggers prototype collision in SheetJS lookup | Exposed via Test |
| **ADV-P1-07** | Engine Crash (DoS) | **MEDIUM** | `Object.create(null)` in grid cells triggers unhandled `TypeError: Cannot convert object to primitive value` | Exposed via Test |
| **ADV-P1-08** | Formula Injection | **MEDIUM** | Raw hostile formula triggers (`=, +, -, @, \t, \r, \n, |`) preserved unneutralized in `SheetModel.rows` | Exposed via Test |
| **ADV-P1-09** | Formula Injection | **MEDIUM** | Column headers with formula strings preserved unescaped in `HeaderMetadata.originalHeaders` | Exposed via Test |
| **ADV-P1-10** | Extension Spoofing | **LOW** | File named `data.xlsx` containing CSV text bypasses magic byte check and is parsed as CSV | Exposed via Test |
| **ADV-P1-11** | Corrupted Binary Stream | **LOW** | Corrupted Central Directory entry signature (`sig !== 0x02014b50`) exits silently instead of throwing | Exposed via Test |
| **ADV-P1-12** | Heuristic Blind Spot | **LOW** | Header detection only scans rows 0..20, completely missing headers positioned at row index > 20 | Exposed via Test |

---

## 3. Deep-Dive Vulnerability & Attack Vector Analyses

### Vector 1: Zip Bomb Variants & Crafted Headers

#### ADV-P1-04: Division-by-Zero Bypass in Compression Ratio Check (`compressedSize === 0`)
- **Severity**: HIGH (CWE-400: Uncontrolled Resource Consumption)
- **Affected File**: [`packages/engine/src/parse/zip.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/parse/zip.ts#L118-L125)
- **Mechanism**:
  In `zip.ts`, the entry-level compression ratio check is guarded by:
  ```ts
  if (compressedSize > 0) {
    const ratio = uncompressedSize / compressedSize;
    if (ratio > MAX_COMPRESSION_RATIO && uncompressedSize > 1024 * 1024) {
      throw new ZipBombError(...);
    }
  }
  ```
  And archive-level ratio calculation:
  ```ts
  const compressionRatio =
    totalCompressedSize > 0
      ? totalUncompressedSize / totalCompressedSize
      : 1;

  if (totalCompressedSize > 0 && compressionRatio > MAX_COMPRESSION_RATIO) {
    throw new ZipBombError(...);
  }
  ```
  When an attacker crafts a ZIP header with `compressedSize = 0` and `uncompressedSize = 150,000,000` (150MB):
  1. `compressedSize > 0` evaluates to `false`, bypassing the entry ratio check.
  2. `totalCompressedSize` remains `0`.
  3. `totalCompressedSize > 0` evaluates to `false`, defaulting `compressionRatio` to `1`.
  4. The archive ratio check evaluates to `false`.
  The synthetic decompression bomb passes inspection with `compressionRatio: 1:1`.
- **Proof of Concept**:
  Covered in test `ADV-V1-01`:
  ```ts
  const zip = createMockZipWithCD([{
    filename: 'xl/worksheets/sheet1.xml',
    compressedSize: 0,
    uncompressedSize: 150 * 1024 * 1024,
  }]);
  const res = inspectZipArchive(zip);
  expect(res.compressionRatio).toBe(1); // Bypass confirmed!
  ```
- **Remediation**:
  If `uncompressedSize > 0` and `compressedSize === 0`, immediately flag as a decompression bomb:
  ```ts
  if (uncompressedSize > 0 && compressedSize === 0) {
    throw new ZipBombError(`Entry "${filename}" specifies 0 compressed bytes with non-zero uncompressed size`);
  }
  ```

---

### Vector 2: Malformed / Corrupted Binary Streams & Magic Byte Guard Bypasses

#### ADV-P1-10: Extension Spoofing: `.xlsx` Disguising CSV Text Bypasses Magic Byte Check
- **Severity**: LOW (CWE-351: Insufficient Type Distinction)
- **Affected File**: [`packages/engine/src/parse/guards.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/parse/guards.ts#L61-L98)
- **Mechanism**:
  `validateUploadGuards` checks if a `.csv` extension contains ZIP data (lines 63-67) or OLE data (lines 79-83). However, it does not check the reverse: if a file has extension `.xlsx` but contains CSV text, `isZip` is false, `isOle` is false, and `isLikelyBinary` is false. The function falls through to `detectDelimitedTextType`, detects commas, and returns `{ fileType: 'csv' }` without throwing a `MagicBytesMismatchError`.
- **Proof of Concept**:
  Covered in test `ADV-V2-01`:
  ```ts
  const csvContent = new TextEncoder().encode('id,name\n1,Alice');
  const res = validateUploadGuards(csvContent, 'data.xlsx');
  expect(res.fileType).toBe('csv'); // Silently reclassified without error
  ```
- **Remediation**:
  Enforce two-way extension verification: if `extension === 'xlsx'` or `extension === 'xls'`, require matching magic bytes.

#### ADV-P1-11: Silent Loop Termination on Corrupted Central Directory Entry Signature
- **Severity**: LOW (CWE-754: Improper Check for Unusual or Exceptional Conditions)
- **Affected File**: [`packages/engine/src/parse/zip.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/parse/zip.ts#L82-L86)
- **Mechanism**:
  In `zip.ts`, if EOCD is valid and points to `cdOffset`, but the signature at `cursor` is not `0x02014b50` (`PK\x01\x02`):
  ```ts
  const sig = view.getUint32(cursor, true);
  if (sig !== 0x02014b50) {
    break;
  }
  ```
  The loop breaks silently, returning `{ entries: [], totalCompressedSize: 0, totalUncompressedSize: 0, compressionRatio: 1 }` instead of throwing `CorruptedFileError`.
- **Remediation**:
  Throw `CorruptedFileError('Invalid Central Directory entry signature')` when `cursor < cdEnd` and `sig !== 0x02014b50`.

---

### Vector 3: Prototype Pollution Keys in Sheet Names, Headers, & Cells

#### ADV-P1-05: Prototype Pollution Acceptance in `SheetModel.name`
- **Severity**: MEDIUM (CWE-1321: Improperly Controlled Modification of Object Prototype Attributes)
- **Affected File**: [`packages/engine/src/normalise/sheet.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/sheet.ts#L76-L82)
- **Mechanism**:
  While column header keys are sanitized via `sanitiseHeaders` to `SafeIdentifierSchema`, `SheetModel.name` is only constrained to `z.string().min(1).max(128)` in `SheetModelSchema`. A sheet named `__proto__`, `constructor`, or `prototype` is valid according to contracts. When downstream web clients or cache stores build lookup tables:
  ```ts
  const sheetMap: Record<string, SheetModel> = {};
  for (const s of workbook.sheets) {
    sheetMap[s.name] = s;
  }
  ```
  Setting `sheetMap['__proto__'] = s` pollutes the runtime prototype.
- **Proof of Concept**:
  Covered in test `ADV-V3-01`:
  ```ts
  const rawSheet = { name: '__proto__', grid: [['col1'], ['val1']], merges: [] };
  const sheetModel = normaliseSheet(rawSheet, 0);
  expect(sheetModel.name).toBe('__proto__');
  ```
- **Remediation**:
  Apply prototype pollution keyword checks or slug sanitization to sheet names (e.g. `sheet.name = sanitizeSheetName(rawSheet.name)`).

#### ADV-P1-06: Sheet Lookup Collision on `constructor` / `toString`
- **Severity**: MEDIUM (CWE-706: Use of Incorrectly-Resolved Name or Reference)
- **Affected File**: [`packages/engine/src/parse/sheetjs.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/parse/sheetjs.ts#L72-L75)
- **Mechanism**:
  In `sheetjs.ts`, worksheets are retrieved from `workbook.Sheets[sheetName]`. In JavaScript, `workbook.Sheets` is a standard object inheriting from `Object.prototype`. If an Excel workbook contains a sheet named `constructor`, `workbook.Sheets['constructor']` resolves to `Object.prototype.constructor` (the `[Function: Object]`). Because `(Object as any)['!ref']` is `undefined`, the sheet data is lost and an empty sheet is returned.
- **Remediation**:
  Use `Object.prototype.hasOwnProperty.call(workbook.Sheets, sheetName)` or `Object.hasOwn` before accessing `workbook.Sheets[sheetName]`.

#### ADV-P1-07: Unhandled `TypeError` Crash on `Object.create(null)` Grid Cells
- **Severity**: MEDIUM (CWE-248: Uncaught Exception)
- **Affected Files**:
  - [`packages/engine/src/normalise/header.ts#L61`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/header.ts#L61)
  - [`packages/engine/src/normalise/sanitise.ts#L13`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/sanitise.ts#L13)
  - [`packages/engine/src/normalise/noise.ts#L27`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/noise.ts#L27)
  - [`packages/engine/src/normalise/cell.ts#L42`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/cell.ts#L42)
- **Mechanism**:
  Throughout the normalisation pipeline, raw cell values are converted to strings via `String(val)`. In JavaScript, calling `String()` on an object with no prototype (`Object.create(null)`) throws:
  `TypeError: Cannot convert object to primitive value`.
  This unhandled exception crashes the ingestion pipeline.
- **Proof of Concept**:
  Covered in test `ADV-V3-03`:
  ```ts
  const grid = [['Col1', Object.create(null)], ['Val1', 'Val2']];
  expect(() => detectHeaderRow(grid)).toThrow(/Cannot convert object to primitive value/);
  ```
- **Remediation**:
  Safely convert values with a null-safe utility:
  ```ts
  function safeToString(val: unknown): string {
    if (val === null || val === undefined) return '';
    try {
      return String(val);
    } catch {
      return '';
    }
  }
  ```

---

### Vector 4: Hostile Cell Strings & Formula Injection Neutralization

#### ADV-P1-08: Unneutralized Formula Triggers in `SheetModel.rows`
- **Severity**: MEDIUM (CWE-1236: Improper Neutralization of Formula Elements in CSV File)
- **Affected File**: [`packages/engine/src/normalise/cell.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/cell.ts#L11-L17)
- **Mechanism**:
  `normaliseCellValue` returns string values verbatim. Dangerous formula triggers (`=cmd|' /C calc'`, `+HYPERLINK(...)`, `@SUM`, `\t=calc`, `\n=1`, `|cmd`) remain unescaped. While SheetJS does not execute formulas at ingest time (`cellFormula: false`), contracts' `SampleValueSchema` strictly rejects strings starting with formula prefixes (`^[=+\-@\t\r\n|]`). If downstream profiling or exports consume raw `SheetModel.rows`, `SampleValueSchema.parse()` fails.
- **Proof of Concept**:
  Covered in test `ADV-V4-01`:
  ```ts
  const rowVal = sheetModel.rows[0]['formula_col'];
  expect(rowVal).toBe("=cmd|'/C calc'!A0");
  expect(() => SampleValueSchema.parse(rowVal)).toThrow();
  ```
- **Remediation**:
  Ensure export paths and profiling models sanitize cell values using single-quote prepending, and document that `SheetModel.rows` holds literal raw values.

#### ADV-P1-09: Unescaped Formula Strings in `HeaderMetadata.originalHeaders`
- **Severity**: MEDIUM (CWE-1236)
- **Affected File**: [`packages/engine/src/normalise/header.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/header.ts#L169)
- **Mechanism**:
  `originalHeaders` stores raw column names as extracted from the grid. A header containing `=cmd|' /C calc'!A0` is sanitized into `_cmd_c_calc_a0` for `sanitizedKeys`, but remains verbatim in `originalHeaders` and `ColumnMetadata.originalName`.
- **Remediation**:
  Neutralize formula prefixes when rendering or exporting `originalHeaders`.

---

### Vector 5: Pathological Grids & Boundary Exhaustion

#### ADV-P1-12: Header Detection Heuristic Blind Spot (> 20 Leading Rows)
- **Severity**: LOW (Functional Limitation / Data Misclassification)
- **Affected File**: [`packages/engine/src/normalise/header.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/normalise/header.ts#L44)
- **Mechanism**:
  `detectHeaderRow` caps evaluation at row 20:
  ```ts
  const maxCandidateRow = Math.min(20, grid.length - 1);
  ```
  If a spreadsheet contains 25 title or spacer rows before the table header, the header row is missed completely. The algorithm defaults to row 0 with low confidence, causing the true headers at row 25 to be parsed as data rows.
- **Remediation**:
  Skip leading empty spacer rows before bounding candidate rows to 20 evaluated non-empty rows.

---

### Vector 6: Macro Workbooks Disguised as .xlsx or Plain CSV

#### ADV-P1-01: Macro Inspection Bypass via Windows Backslash Path Separator
- **Severity**: HIGH (CWE-178: Improper Handling of Case Sensitivity, Path Separators)
- **Affected File**: [`packages/engine/src/parse/zip.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/parse/zip.ts#L19-L24)
- **Mechanism**:
  In `zip.ts`, `MACRO_ENTRY_PATTERNS` defines:
  ```ts
  const MACRO_ENTRY_PATTERNS = [
    /vbaproject\.bin$/i,
    /vbaprojectsignature\.bin$/i,
    /xl\/macros\//i,
    /macroenabled/i,
  ];
  ```
  Pattern 3 (`/xl\/macros\//i`) strictly matches forward slashes (`/`). On Windows, or in malicious ZIP files constructed with backslash delimiters (`\`), the entry name is `xl\macros\sheet1.bin`.
  Testing regex evaluation:
  ```ts
  /xl\/macros\//i.test('xl\\macros\\sheet1.bin') === false
  ```
  The entry bypasses `MACRO_ENTRY_PATTERNS` completely.
- **Proof of Concept**:
  Covered in test `ADV-V6-01`:
  ```ts
  const zip = createMockZipWithCD([{
    filename: 'xl\\macros\\sheet1.bin',
    compressedSize: 100,
    uncompressedSize: 500,
  }]);
  const res = inspectZipArchive(zip);
  expect(res.entries.map(e => e.filename)).toContain('xl\\macros\\sheet1.bin'); // Bypass confirmed!
  ```
- **Remediation**:
  Normalize path separators or support both slashes:
  ```ts
  /xl[/\\]macros[/\\]/i
  ```
  Or normalize the entry filename with `filename.replace(/\\/g, '/')` before regex testing.

#### ADV-P1-02: Excel 4.0 XLM Macro Sheets Bypass (`xl/macroSheets/*.xml`)
- **Severity**: HIGH (CWE-434: Unrestricted Upload of File with Dangerous Type)
- **Affected File**: [`packages/engine/src/parse/zip.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/parse/zip.ts#L19-L24)
- **Mechanism**:
  In Office Open XML, Excel 4.0 (XLM) macro workbooks store executable macro sheets under the `xl/macroSheets/` directory (e.g. `xl/macroSheets/sheet1.xml`).
  Evaluating `xl/macroSheets/sheet1.xml` against `MACRO_ENTRY_PATTERNS`:
  - `/vbaproject\.bin$/i` -> `false`
  - `/vbaprojectsignature\.bin$/i` -> `false`
  - `/xl\/macros\//i` -> `false` (`macroSheets` is not `macros/`)
  - `/macroenabled/i` -> `false` (`macroSheets` is not `macroenabled`)
  Excel 4.0 macro workbooks renamed to `.xlsx` completely bypass upload guards.
- **Proof of Concept**:
  Covered in test `ADV-V6-02`:
  ```ts
  const zip = createMockZipWithCD([{
    filename: 'xl/macroSheets/sheet1.xml',
    compressedSize: 100,
    uncompressedSize: 500,
  }]);
  const res = inspectZipArchive(zip);
  expect(res.entries.map(e => e.filename)).toContain('xl/macroSheets/sheet1.xml'); // Bypass confirmed!
  ```
- **Remediation**:
  Expand `MACRO_ENTRY_PATTERNS`:
  ```ts
  const MACRO_ENTRY_PATTERNS = [
    /vbaproject\.bin$/i,
    /vbaprojectsignature\.bin$/i,
    /xl[/\\]macros[/\\]/i,
    /xl[/\\]macrosheets[/\\]/i,
    /macrosheet/i,
    /macroenabled/i,
  ];
  ```

#### ADV-P1-03: Missing Macro Inspection in Legacy OLE (`.xls`) Workbooks
- **Severity**: HIGH (CWE-434)
- **Affected File**: [`packages/engine/src/parse/guards.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/parse/guards.ts#L78-L88)
- **Mechanism**:
  In `guards.ts`, if a file has OLE magic bytes (`[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]`), it checks that the extension is not `.csv` or `.tsv` and immediately returns:
  ```ts
  return {
    fileType: 'xls',
    byteLength: buffer.byteLength,
  };
  ```
  Unlike ZIP archives which are inspected by `inspectZipArchive`, legacy OLE `.xls` files receive **zero inspection for VBA macros or macro storage streams** (`_VBA_PROJECT_CUR`, `VBA`).
- **Proof of Concept**:
  Covered in test `ADV-V6-03`.
- **Remediation**:
  Implement lightweight OLE sector inspection checking for directory entries matching `_VBA_PROJECT_CUR` or `VBA` streams, or reject legacy OLE files containing macro streams.

---

## 4. Automated Test Suite Summary

The adversarial test suite is implemented in [`packages/engine/test/adversarial/adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/adversarial.test.ts).

### Test Coverage Breakdown:
- **Vector 1: Zip Bomb Variants (5 tests)**:
  - `ADV-V1-01`: Zero compressed size ratio bypass
  - `ADV-V1-02`: High ratio under 1MB threshold bypass
  - `ADV-V1-03`: Total uncompressed size limit enforcement (200MB)
  - `ADV-V1-04`: ZIP64 bounds rejection
  - `ADV-V1-05`: Central Directory vs Local File Header desynchronization
- **Vector 2: Malformed Streams & Magic Bytes (7 tests)**:
  - `ADV-V2-01`: CSV disguised as `.xlsx` extension spoofing
  - `ADV-V2-02`: Silent loop break on corrupted Central Directory entry signature
  - `ADV-V2-03`: Truncated ZIP buffers < 22 bytes
  - `ADV-V2-04`: Central Directory offset out of bounds
  - `ADV-V2-05`: 0-byte upload and >10MB size limit
  - `ADV-V2-06`: Rejection of non-spreadsheet binary files (ELF, PDF)
  - `ADV-V2-07`: Rejection of ZIP binary disguised with `.csv` extension
- **Vector 3: Prototype Pollution Keys (5 tests)**:
  - `ADV-V3-01`: Prototype pollution acceptance in `SheetModel.name`
  - `ADV-V3-02`: Sheet lookup collision on `constructor`
  - `ADV-V3-03`: `Object.create(null)` unhandled `TypeError` crash
  - `ADV-V3-04`: Header sanitisation of prototype keys
  - `ADV-V3-05`: Handling of `toString`, `valueOf`, `isPrototypeOf`
- **Vector 4: Hostile Cell Strings & Formula Injection (4 tests)**:
  - `ADV-V4-01`: Unneutralized formula triggers in `SheetModel.rows`
  - `ADV-V4-02`: Raw unescaped formula strings in `HeaderMetadata.originalHeaders`
  - `ADV-V4-03`: Literal reading of CSV formula injection strings
  - `ADV-V4-04`: Impact of numeric formula headers on scoring
- **Vector 5: Pathological Grids & Boundary Exhaustion (5 tests)**:
  - `ADV-V5-01`: Pathological 0x0 and 1x0 empty grid normalization
  - `ADV-V5-02`: Header detection blind spot beyond row 20
  - `ADV-V5-03`: Stripping 10,000 trailing blank rows
  - `ADV-V5-04`: Handling inverted and out-of-bounds merge ranges
  - `ADV-V5-05`: Normalizing non-ASCII, emoji, and special symbol headers
- **Vector 6: Macro Workbooks Disguised (5 tests)**:
  - `ADV-V6-01`: Macro bypass via Windows backslash path separator
  - `ADV-V6-02`: Excel 4.0 XLM Macro sheet bypass (`xl/macroSheets/`)
  - `ADV-V6-03`: Missing VBA macro inspection in legacy OLE (`.xls`)
  - `ADV-V6-04`: Rejection of macro extensions (`.xlsm`, `.xlsb`, etc.)
  - `ADV-V6-05`: Rejection of standard VBA macro component (`vbaProject.bin`)

**Total**: 31 automated tests, 100% passing across the suite.

---

## 5. Remediation Recommendations for Phase 1 Engine Hardening

1. **Harden Macro Pattern Matching**:
   Normalize ZIP filenames to POSIX paths (`filename.replace(/\\/g, '/')`) and expand `MACRO_ENTRY_PATTERNS` to include `/macrosheet/i` and `/xl\/macrosheets\//i`.
2. **Defend Against Zero Compressed Size Zip Bombs**:
   Reject any ZIP entry where `uncompressedSize > 0 && compressedSize === 0` as a decompression bomb.
3. **Guard Against Null-Prototype Objects**:
   Wrap string conversions in a safe helper (`safeToString`) that safely handles `Object.create(null)` without throwing `TypeError`.
4. **Constrain `SheetModel.name`**:
   Sanitize or validate sheet names against prototype pollution keys (`__proto__`, `constructor`, `prototype`).
5. **Use Prototype-Safe Property Access in SheetJS**:
   Access `workbook.Sheets` using `Object.hasOwn(workbook.Sheets, sheetName)` rather than direct property indexing.
6. **Implement OLE VBA Macro Inspection**:
   Inspect CFB/OLE sector allocation tables or directory entries for `_VBA_PROJECT_CUR` or `VBA` streams.
