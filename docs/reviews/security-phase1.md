# Phase 1 Ingest, Normalise & Fixtures Security Audit Report

**Audit Target**: Unsheet Phase 1 Deliverables  
- Parser & Guards: `packages/engine/src/parse/**` (`guards.ts`, `zip.ts`, `sheetjs.ts`, `hash.ts`, `errors.ts`)  
- Normalisation Pipeline: `packages/engine/src/normalise/**` (`header.ts`, `merge.ts`, `noise.ts`, `sanitise.ts`, `sheet.ts`, `workbook.ts`, `cell.ts`)  
- Test Corpora & Baselines: `packages/fixtures/**` (`generators/**`, `golden/**`, test suite)  
**Auditor**: Independent Application Security Auditor  
**Date**: October 4, 2026  
**Status**: Completed  
**Compliance Standard**: `docs/THREAT_MODEL.md`, `docs/SPEC.md`, Section 4 Mandatory Mitigations (1, 2, 3, 4, 5)  

---

## 1. Executive Summary

An exhaustive independent application security audit was performed on the Phase 1 deliverables of the Unsheet project. This review encompassed the upload guardrails, ZIP archive inspector, SheetJS ingestion engine, normalization pipeline (header detection, noise elimination, cell coercion, merged-cell propagation, and workbook assembly), and the 28 synthetic and domain test fixtures.

The Phase 1 deliverables implement critical defense mechanisms: file size limiting, magic bytes sniffing, cached-only formula extraction (`cell.v`), column identifier sanitization preventing direct prototype keyword collisions (`safe___proto__`), and pre-decompression ZIP header scanning. 

However, deep architectural and defensive analysis revealed significant vulnerabilities, logic bypasses, and specification violations across multiple threat vectors:
1. **Critical Zip-Bomb & Decompression Defense Bypasses**: The pre-decompression inspector (`inspectZipArchive`) validates only declared ZIP metadata headers. Fabricated headers (e.g. Fifield-style DEFLATE bombs claiming modest uncompressed sizes) pass inspection, after which `XLSX.read()` inflates the stream synchronously without an uncompressed byte cap, causing browser tab crashes and V8 heap exhaustion. Furthermore, entries with `compressedSize === 0` trigger a division-by-zero bypass where compression ratio defaults to `1:1`, allowing a 150MB expansion from zero compressed bytes.
2. **Macro Inspection Bypasses**: Excel 4.0 XLM macro sheets (`xl/macroSheets/sheet1.xml` or `xl/macrosheets/`) bypass the macro detection regex due to an overly rigid trailing slash (`/xl\/macros\//i`). Windows backslash path separators (`xl\macros\sheet1.bin`) and `.xlsb` binary workbooks renamed to `.xlsx` also bypass macro rejection. Additionally, legacy Excel macro extensions (`.xlm`, `.xla`) are missing from extension guards.
3. **Missing XML Entity Expansion Safeguards**: Contrary to Mitigation 2 of `docs/THREAT_MODEL.md`, `sheetjs.ts` fails to configure `doctype: false` and `nodeProcess: false` in `XLSX.read()`, leaving the XML parser vulnerable to DTD resolution and entity expansion attacks.
4. **Aggregate Multi-Sheet Denial of Service**: Ingestion limits enforce `MAX_ROWS = 200_000` and `MAX_COLUMNS = 200` per sheet, but lack an aggregate workbook bound. A workbook with 20 sheets at maximum dimensions forces 800,000,000 cell allocations (~6.4GB+ RAM), crashing the client.
5. **Defense-in-Depth Violations**: Normalization reconstructs row records with `Object.assign({}, record)`, re-attaching `Object.prototype` and violating Mitigation 4's requirement for null-prototype objects (`Object.create(null)`). In addition, `SheetModel.name` accepts arbitrary strings (`__proto__`, `constructor`), and `detectHeaderRow` crashes with an unhandled `TypeError` when encountering null-prototype cell values.

A total of **16 findings** were identified: **3 Critical**, **5 High**, **5 Medium**, and **3 Low**.

---

## 2. Findings Summary Matrix

| ID | Title | Severity | STRIDE Category | Affected Component |
|---|---|---|---|---|
| **SEC-P1-01** | Decompression Bomb / Tab Crash via Lying ZIP Headers & Unbounded Synchronous Inflation | **Critical** | Denial of Service | `packages/engine/src/parse/zip.ts`, `sheetjs.ts` |
| **SEC-P1-02** | Division-by-Zero / Infinite Compression Ratio Bypass When `compressedSize === 0` | **Critical** | Denial of Service / Tampering | `packages/engine/src/parse/zip.ts` |
| **SEC-P1-03** | Macro Rejection Bypasses via Excel 4.0 XLM Paths, Backslashes, & Missing Extensions | **Critical** | Elevation of Privilege / Macro Execution | `packages/engine/src/parse/zip.ts`, `guards.ts` |
| **SEC-P1-04** | `.xlsb` Binary Workbook Extension Bypass & Ingestion as `.xlsx` | **High** | Tampering / Elevation of Privilege | `packages/engine/src/parse/guards.ts`, `zip.ts` |
| **SEC-P1-05** | Missing XML Entity Expansion & Billion Laughs Options in SheetJS Reader | **High** | Denial of Service / XXE | `packages/engine/src/parse/sheetjs.ts` |
| **SEC-P1-06** | Aggregate Multi-Sheet Ingestion Memory Exhaustion (800M Cells DoS) | **High** | Denial of Service | `packages/engine/src/parse/sheetjs.ts`, `workbook.ts` |
| **SEC-P1-07** | Silent Loop Break on Corrupted Central Directory Entry Fails Open | **High** | Denial of Service / Tampering | `packages/engine/src/parse/zip.ts` |
| **SEC-P1-08** | Unbounded Merge Ranges Causing Cartesian CPU Exhaustion in `applyMergeForwardFill` | **High** | Denial of Service | `packages/engine/src/parse/sheetjs.ts`, `merge.ts` |
| **SEC-P1-09** | Prototype Invariant Violation via `Object.assign({}, record)` in Sheet Normalization | **Medium** | Elevation of Privilege / Tampering | `packages/engine/src/normalise/sheet.ts` |
| **SEC-P1-10** | Prototype Key Injection in `SheetModel.name` & SheetJS Worksheet Property Shadowing | **Medium** | Elevation of Privilege / Data Loss | `packages/engine/src/normalise/sheet.ts`, `sheetjs.ts` |
| **SEC-P1-11** | Unhandled `TypeError` Crash in Header Detection on Null-Prototype Cell Values | **Medium** | Denial of Service | `packages/engine/src/normalise/header.ts` |
| **SEC-P1-12** | Unchecked Legacy OLE (`.xls`) Workbooks for Embedded VBA Macros | **Medium** | Elevation of Privilege / Macro Execution | `packages/engine/src/parse/guards.ts` |
| **SEC-P1-13** | Trailing Data Loss Bug in `noise.ts` for Narrow Tables (1–2 Columns) | **Medium** | Data Integrity / Tampering | `packages/engine/src/normalise/noise.ts` |
| **SEC-P1-14** | Insecure Pseudo-Random PRNG in `generateSafeEntityId` | **Low** | Spoofing / Information Disclosure | `packages/engine/src/normalise/sheet.ts` |
| **SEC-P1-15** | Untrimmed Cell Values in `normaliseCellValue` Violating Fixture Specification | **Low** | Data Inconsistency | `packages/engine/src/normalise/cell.ts` |
| **SEC-P1-16** | Negative Coordinates and Out-of-Bounds Indexing on Malformed SheetJS `!ref` | **Low** | Denial of Service / Bounds Check | `packages/engine/src/parse/sheetjs.ts` |

---

## 3. Detailed Audit Findings

### [SEC-P1-01] Decompression Bomb / Tab Crash via Lying ZIP Headers & Unbounded Synchronous Inflation
- **Severity**: **Critical**
- **STRIDE Category**: Denial of Service (DoS) / Tab Crash
- **Target**: `packages/engine/src/parse/zip.ts` (lines 88–135, 170–193), `packages/engine/src/parse/sheetjs.ts` (lines 47–53)
- **Description**:  
  `docs/THREAT_MODEL.md` Mitigation 1 requires:
  > *"Uncompressed stream cap: Maximum 200 MB uncompressed buffer limit during ZIP decompression (`MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024`). Compression ratio check: Abort decompression if `uncompressed_bytes / compressed_bytes > 100`."*
  
  The current implementation in `inspectZipArchive` inspects only the metadata fields (`uncompressedSize` and `compressedSize`) recorded in the Central Directory and Local File Headers. In crafted zip bombs (such as David Fifield's non-recursive zip bombs or archives with spoofed header values), the header fields declare an arbitrary small uncompressed size (e.g. 50,000 bytes) with a legitimate 2:1 ratio.
  
  Because `inspectZipArchive` does not inspect the actual compressed stream or decompress with an abortable byte counter, it returns successfully. Execution immediately moves to `parseSheetJs`, which invokes `XLSX.read(buffer, { type: 'array', ... })`. SheetJS uses native `zlib` (in Node) or its internal `_inflate` loop (in browsers), which continues decompressing the DEFLATE stream until `BFINAL` or stream end. The stream expands to multiple gigabytes of null/repetitive data, causing an unrecoverable out-of-memory crash of the browser tab or worker process.
- **Vulnerability Impact**: Complete Denial of Service (browser tab termination, UI thread freeze, memory exhaustion) on any untrusted file upload.
- **Actionable Recommendation**:
  1. Wrap or intercept decompression, or validate file part byte lengths before full parsing. For pure client-side processing, configure a maximum uncompressed byte threshold on SheetJS stream inputs, or use a streaming decompressor (e.g. `DecompressionStream` or a WebAssembly streaming zlib) with a hard abort if emitted bytes exceed `MAX_UNCOMPRESSED_BYTES`.
  2. Implement an execution timeout (e.g. abort controller with 5,000ms deadline) on the parsing worker.

---

### [SEC-P1-02] Division-by-Zero / Infinite Compression Ratio Bypass When `compressedSize === 0`
- **Severity**: **Critical**
- **STRIDE Category**: Denial of Service / Tampering
- **Target**: `packages/engine/src/parse/zip.ts` (lines 117–125, 204–214)
- **Description**:  
  In `inspectZipArchive`, the entry-level compression ratio check is guarded by:
  ```typescript
  if (compressedSize > 0) {
    const ratio = uncompressedSize / compressedSize;
    if (ratio > MAX_COMPRESSION_RATIO && uncompressedSize > 1024 * 1024) {
      throw new ZipBombError(...);
    }
  }
  ```
  The overall compression ratio check is computed as:
  ```typescript
  const compressionRatio =
    totalCompressedSize > 0
      ? totalUncompressedSize / totalCompressedSize
      : 1;

  if (totalCompressedSize > 0 && compressionRatio > MAX_COMPRESSION_RATIO) {
    throw new ZipBombError(...);
  }
  ```
  If an archive entry declares `compressedSize: 0` and `uncompressedSize: 150 * 1024 * 1024` (150MB):
  - The entry-level check is completely skipped because `compressedSize > 0` is false.
  - `totalCompressedSize` remains 0.
  - `compressionRatio` defaults to `1`.
  - The overall ratio check does not execute because `totalCompressedSize > 0` is false.
  - As verified in adversarial test `ADV-V1-01`, a synthetic bomb expanding 150MB from 0 compressed bytes passes without error!
- **Vulnerability Impact**: Synthetic zip bombs with zero-byte compressed sizes or streaming Data Descriptors bypass all compression ratio defenses.
- **Actionable Recommendation**:
  1. Flag any entry with `uncompressedSize > 0 && compressedSize === 0` as a malformed or suspicious entry:
     ```typescript
     if (compressedSize === 0 && uncompressedSize > 0) {
       throw new ZipBombError(
         `Entry "${filename}" specifies 0 compressed bytes with non-zero uncompressed size (${uncompressedSize} bytes)`
       );
     }
     ```
  2. Ensure that if `totalUncompressedSize > 0 && totalCompressedSize === 0`, `inspectZipArchive` immediately throws `ZipBombError`.

---

### [SEC-P1-03] Macro Rejection Bypasses via Excel 4.0 XLM Paths, Backslashes, & Missing Extensions
- **Severity**: **Critical**
- **STRIDE Category**: Elevation of Privilege / Macro Execution
- **Target**: `packages/engine/src/parse/zip.ts` (lines 19–25), `packages/engine/src/parse/guards.ts` (lines 16, 49)
- **Description**:  
  Audit Focus 1 and `docs/THREAT_MODEL.md` mandate strict rejection of `.xlsm`, `.xlsb`, and macro-enabled files. Three distinct bypasses exist in the implementation:
  1. **Excel 4.0 XLM Macro Sheets**: In OpenXML, Excel 4.0 macro sheets are stored under `xl/macroSheets/sheet1.xml` or `xl/macrosheets/sheet1.xml`. The regex in `zip.ts` is:
     ```typescript
     const MACRO_ENTRY_PATTERNS = [
       /vbaproject\.bin$/i,
       /vbaprojectsignature\.bin$/i,
       /xl\/macros\//i,
       /macroenabled/i,
     ];
     ```
     Because `/xl\/macros\//i` requires a literal `/` immediately after `macros`, `/xl\/macros\//i.test('xl/macroSheets/sheet1.xml')` returns `false`.
  2. **Path Separator Evasion**: ZIP archives generated by Windows utilities or maliciously handcrafted often use backslashes (`\`). For `xl\macros\sheet1.bin`, the pattern `/xl\/macros\//i` evaluates to `false` because of the forward slashes.
  3. **Missing Macro Extensions**: In `guards.ts`, `MACRO_EXTENSIONS` is defined as:
     ```typescript
     const MACRO_EXTENSIONS = new Set(['xlsm', 'xlsb', 'xltm', 'xlam']);
     ```
     This set omits `.xlm` (the standard Excel 4.0 macro workbook extension) and `.xla` (the legacy Excel 97–2003 macro add-in extension). Files uploaded with `.xlm` or `.xla` pass the extension check.
- **Vulnerability Impact**: Execution of arbitrary legacy macros (XLM 4.0 or VBA) if users download or export workbooks processed by the application.
- **Actionable Recommendation**:
  1. Update `MACRO_ENTRY_PATTERNS` in `zip.ts` to normalize path separators (`replace(/\\/g, '/')`) and match macro sheets:
     ```typescript
     const MACRO_ENTRY_PATTERNS = [
       /vbaproject\.bin$/i,
       /vbaprojectsignature\.bin$/i,
       /xl\/macros(?:heets)?\//i,
       /macroenabled/i,
       /xl\/workbook\.bin$/i,
     ];
     ```
  2. Add `.xlm` and `.xla` to `MACRO_EXTENSIONS` in `guards.ts`:
     ```typescript
     const MACRO_EXTENSIONS = new Set(['xlsm', 'xlsb', 'xltm', 'xlam', 'xlm', 'xla']);
     ```

---

### [SEC-P1-04] `.xlsb` Binary Workbook Extension Bypass & Ingestion as `.xlsx`
- **Severity**: **High**
- **STRIDE Category**: Tampering / Elevation of Privilege
- **Target**: `packages/engine/src/parse/guards.ts` (lines 41–76), `packages/engine/src/parse/zip.ts` (lines 19–25)
- **Description**:  
  Audit Focus 1 explicitly requires "rejection of .xlsm/.xlsb macros". In `guards.ts`, `.xlsb` rejection is checked purely against the file extension (`MACRO_EXTENSIONS.has(extension)`). 
  
  If an `.xlsb` file is renamed to `data.xlsx` or submitted without an extension, `validateUploadGuards` checks magic bytes:
  - `matchesBytes(buffer, ZIP_MAGIC)` is `true` (since `.xlsb` is a ZIP container).
  - `inspectZipArchive` inspects entries. The entries of an `.xlsb` file are `xl/workbook.bin`, `xl/worksheets/sheet1.bin`, `[Content_Types].xml`.
  - None of these entries match `MACRO_ENTRY_PATTERNS`!
  - `inspectZipArchive` returns successfully.
  - `validateUploadGuards` returns `{ fileType: 'xlsx' }`.
  - SheetJS parses the binary OpenXML streams.
  
  Consequently, `.xlsb` workbooks are processed despite the explicit restriction against `.xlsb` formats.
- **Vulnerability Impact**: Direct bypass of the `.xlsb` format restriction, allowing binary-serialized workbooks into the normalization engine.
- **Actionable Recommendation**:
  Add detection for `.xlsb` components inside `inspectZipArchive`:
  ```typescript
  if (/xl\/workbook\.bin$/i.test(normalizedFilename)) {
    throw new MacroNotAllowedError(
      'Binary workbook format (.xlsb) is strictly prohibited'
    );
  }
  ```

---

### [SEC-P1-05] Missing XML Entity Expansion & Billion Laughs Options in SheetJS Reader
- **Severity**: **High**
- **STRIDE Category**: Denial of Service (DoS) / Information Disclosure (XXE)
- **Target**: `packages/engine/src/parse/sheetjs.ts` (lines 47–53)
- **Description**:  
  `docs/THREAT_MODEL.md` Mitigation 2 states:
  > *"The SheetJS ingestion parser is configured with external entity expansion disabled (`doctype: false`, `nodeProcess: false`). No DTD resolution or external system identifier fetching is permitted."*
  
  In `packages/engine/src/parse/sheetjs.ts`, `XLSX.read()` is invoked as:
  ```typescript
  workbook = XLSX.read(buffer, {
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellText: false,
    WTF: false,
  });
  ```
  Neither `doctype: false` nor `nodeProcess: false` nor `bookVBA: false` are passed to `XLSX.read()`. The configuration directly violates the technical control mandated in Mitigation 2.
- **Vulnerability Impact**: Parser remains susceptible to XML entity expansion loops or unexpected external entity resolution when reading XML components.
- **Actionable Recommendation**:
  Update `XLSX.read` options in `sheetjs.ts` to strictly enforce:
  ```typescript
  workbook = XLSX.read(buffer, {
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellText: false,
    WTF: false,
    doctype: false,
    nodeProcess: false,
    bookVBA: false,
  } as XLSX.ParsingOptions);
  ```

---

### [SEC-P1-06] Aggregate Multi-Sheet Ingestion Memory Exhaustion (800M Cells DoS)
- **Severity**: **High**
- **STRIDE Category**: Denial of Service (DoS)
- **Target**: `packages/engine/src/parse/sheetjs.ts` (lines 64–102), `packages/engine/src/normalise/workbook.ts` (lines 18–25)
- **Description**:  
  Ingestion bounds currently enforce:
  - `workbook.SheetNames.length <= MAX_SHEETS` (20 sheets)
  - `rowCount <= MAX_ROWS` (200,000 rows per sheet)
  - `colCount <= MAX_COLUMNS` (200 columns per sheet)
  
  There is no aggregate workbook limit on total rows or total cell allocations. If an adversary crafts a workbook containing 20 sheets, where each sheet has dimensions of 200,000 rows by 200 columns:
  - The aggregate cell count is $20 \times 200,000 \times 200 = 800,000,000$ cells.
  - In `sheetjs.ts`, `grid = new Array(rowCount)` allocates 40,000,000 array elements per sheet.
  - In `normaliseSheet`, each row is mapped to an object dictionary with 200 keys.
  - An 800-million cell representation exceeds 6.4 GB of heap memory in V8, instantly crashing the client with `JavaScript heap out of memory`.
- **Vulnerability Impact**: Reliable, unrecoverable denial of service and memory crash with a file that fully satisfies every individual sheet bound.
- **Actionable Recommendation**:
  Define and enforce aggregate workbook limits in `contracts/workbook.ts` and `sheetjs.ts`:
  1. `MAX_WORKBOOK_TOTAL_ROWS = 500_000`
  2. `MAX_WORKBOOK_TOTAL_CELLS = 5_000_000`
  3. Abort with `SheetBoundsError` as soon as the cumulative cell count across all sheets exceeds `MAX_WORKBOOK_TOTAL_CELLS`.

---

### [SEC-P1-07] Silent Loop Break on Corrupted Central Directory Entry Fails Open
- **Severity**: **High**
- **STRIDE Category**: Denial of Service / Tampering
- **Target**: `packages/engine/src/parse/zip.ts` (lines 82–86)
- **Description**:  
  In `inspectZipArchive`, when iterating through the Central Directory:
  ```typescript
  const sig = view.getUint32(cursor, true);
  if (sig !== 0x02014b50) {
    // "PK\x01\x02"
    break;
  }
  ```
  If an archive has a valid EOCD but the very first Central Directory entry has a corrupted signature (or intentional garbage), `sig !== 0x02014b50` is met, and the code immediately executes `break;`!
  
  As proven in adversarial test `ADV-V2-02`:
  - `entries` remains empty (`[]`).
  - `totalUncompressedSize` is 0.
  - `compressionRatio` defaults to 1.
  - `inspectZipArchive` returns successfully with zero entries!
  - `validateUploadGuards` passes the file to `parseSheetJs`.
- **Vulnerability Impact**: Fails open on corrupted archives, bypassing macro inspection and compression ratio checks for all subsequent entries in the archive.
- **Actionable Recommendation**:
  Throw `CorruptedFileError` instead of breaking silently:
  ```typescript
  const sig = view.getUint32(cursor, true);
  if (sig !== 0x02014b50) {
    throw new CorruptedFileError(
      `Invalid ZIP Central Directory entry signature (0x${sig.toString(16)}) at offset ${cursor}`
    );
  }
  ```

---

### [SEC-P1-08] Unbounded Merge Ranges Causing Cartesian CPU Exhaustion in `applyMergeForwardFill`
- **Severity**: **High**
- **STRIDE Category**: Denial of Service (DoS)
- **Target**: `packages/engine/src/parse/sheetjs.ts` (lines 131–140), `packages/engine/src/normalise/merge.ts` (lines 7–42)
- **Description**:  
  In `sheetjs.ts`, `ws['!merges']` is extracted without any bounds:
  ```typescript
  if (Array.isArray(ws['!merges'])) {
    for (const m of ws['!merges']) {
      merges.push(...);
    }
  }
  ```
  In `applyMergeForwardFill`, the engine iterates sequentially through all merge objects:
  ```typescript
  for (const merge of merges) {
    const { startRow, startCol, endRow, endCol } = merge;
    ...
    for (let r = startRow; r <= maxR; r++) {
      for (let c = startCol; c <= maxC; c++) {
        targetRow[c] = topLeftValue;
      }
    }
  }
  ```
  An attacker can craft a spreadsheet containing 500,000 merge ranges spanning overlapping ranges. This creates a nested loop performing tens of billions of iterations, locking the main JavaScript event loop for minutes.
- **Vulnerability Impact**: CPU starvation and thread unresponsiveness (DoS) triggered by malicious merge metadata.
- **Actionable Recommendation**:
  1. Impose a strict cap on the number of merge ranges processed: `MAX_MERGE_RANGES = 10_000`.
  2. If `merges.length > MAX_MERGE_RANGES`, log a warning and truncate or throw `SheetBoundsError`.
  3. Skip redundant 1x1 merges where `startRow === endRow && startCol === endCol`.

---

### [SEC-P1-09] Prototype Invariant Violation via `Object.assign({}, record)` in Sheet Normalization
- **Severity**: **Medium**
- **STRIDE Category**: Elevation of Privilege / Tampering
- **Target**: `packages/engine/src/normalise/sheet.ts` (lines 63–74)
- **Description**:  
  `docs/THREAT_MODEL.md` Mitigation 4 explicitly requires:
  > *"All internal dictionaries and row storage records are created using `Object.create(null)` or sanitized `Map` objects."*
  
  In `packages/engine/src/normalise/sheet.ts`, lines 63–73 construct row records:
  ```typescript
  const record: Record<string, unknown> = Object.create(null);

  for (let c = 0; c < columns.length; c++) {
    const col = columns[c];
    if (!col) continue;
    const rawCell = rawRow[c];
    record[col.key] = normaliseCellValue(rawCell);
  }

  // Convert to plain object safely
  rows.push(Object.assign({}, record) as Record<SafeIdentifier, unknown>);
  ```
  By calling `Object.assign({}, record)`, the row records are converted back into standard objects with `Object.prototype` as their prototype (`Object.getPrototypeOf(row) === Object.prototype`). This directly violates Mitigation 4.
  
  Furthermore, `Object.assign(target, source)` performs property assignment via `[[Set]]`. If any property key were `__proto__`, it would invoke `Object.prototype.__proto__` setter on the target object.
- **Vulnerability Impact**: Defeats defense-in-depth prototype pollution protection; row records inherit standard prototype methods (`toString`, `valueOf`), making them vulnerable to property shadowing bugs in downstream consumers.
- **Actionable Recommendation**:
  Push the `record` directly without `Object.assign`:
  ```typescript
  rows.push(record as Record<SafeIdentifier, unknown>);
  ```

---

### [SEC-P1-10] Prototype Key Injection in `SheetModel.name` & SheetJS Worksheet Property Shadowing
- **Severity**: **Medium**
- **STRIDE Category**: Elevation of Privilege / Data Loss
- **Target**: `packages/engine/src/normalise/sheet.ts` (lines 76–81), `packages/engine/src/parse/sheetjs.ts` (lines 72–81)
- **Description**:  
  Two prototype property vulnerabilities affect sheet names:
  1. `SheetModelSchema.name` allows any string up to 128 characters (`z.string().min(1).max(128)`). Unlike column headers which must satisfy `SafeIdentifierSchema` and `FORBIDDEN_OBJECT_KEYS`, sheet names are not checked against prototype keywords. If a sheet is named `__proto__` or `constructor` and downstream systems index sheets in a dictionary (`sheets[sheet.name] = sheet`), prototype pollution occurs (adversarial test `ADV-V3-01`).
  2. In `sheetjs.ts`, line 73 accesses `const ws = workbook.Sheets[sheetName]`. If `sheetName === 'constructor'`, `workbook.Sheets['constructor']` returns the native `Function Object()` constructor rather than undefined or a sheet. Because `Function['!ref']` is undefined, the sheet data is dropped as empty (adversarial test `ADV-V3-02`).
- **Vulnerability Impact**: State corruption in downstream components indexing sheets by name; data loss for sheets named `constructor`.
- **Actionable Recommendation**:
  1. Sanitize sheet names using `Object.hasOwn` when indexing `workbook.Sheets`:
     ```typescript
     const ws = Object.prototype.hasOwnProperty.call(workbook.Sheets, sheetName)
       ? workbook.Sheets[sheetName]
       : undefined;
     ```
  2. Disallow prototype pollution keys in sheet names, prefixing them if found:
     ```typescript
     const safeSheetName = FORBIDDEN_SET.has(rawSheet.name.toLowerCase())
       ? `safe_${rawSheet.name}`
       : rawSheet.name;
     ```

---

### [SEC-P1-11] Unhandled `TypeError` Crash in Header Detection on Null-Prototype Cell Values
- **Severity**: **Medium**
- **STRIDE Category**: Denial of Service (DoS)
- **Target**: `packages/engine/src/normalise/header.ts` (lines 61, 76, 109, 163)
- **Description**:  
  In `detectHeaderRow`, cell values are coerced to strings using `String(val)`.
  If an upstream parsing pass or custom caller populates a cell in `grid` with a null-prototype object (`Object.create(null)`), JavaScript throws:
  `TypeError: Cannot convert object to primitive value` (adversarial test `ADV-V3-03`).
  This unhandled exception crashes the entire normalization pipeline.
- **Vulnerability Impact**: Unhandled crash / DoS on null-prototype cell values.
- **Actionable Recommendation**:
  Safely convert cell values to strings using a defensive helper:
  ```typescript
  function safeString(val: unknown): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object' && Object.getPrototypeOf(val) === null) {
      return '';
    }
    return String(val);
  }
  ```

---

### [SEC-P1-12] Unchecked Legacy OLE (`.xls`) Workbooks for Embedded VBA Macros
- **Severity**: **Medium**
- **STRIDE Category**: Elevation of Privilege / Macro Execution
- **Target**: `packages/engine/src/parse/guards.ts` (lines 78–88)
- **Description**:  
  In `validateUploadGuards`:
  ```typescript
  if (isOle) {
    if (extension === 'csv' || extension === 'tsv') {
      throw new MagicBytesMismatchError(...);
    }
    return {
      fileType: 'xls',
      byteLength: buffer.byteLength,
    };
  }
  ```
  When OLE magic bytes are matched (`0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1`), the guard returns `{ fileType: 'xls' }` without checking for embedded VBA macros. Legacy `.xls` files frequently carry VBA project streams (`_VBA_PROJECT_CUR`, `VBA`, `dir`). While SheetJS does not execute VBA code during parsing, this represents an inconsistent macro defense posture between XLSX (inspected) and XLS (uninspected).
- **Vulnerability Impact**: Macro-enabled `.xls` documents pass upload validation unchecked.
- **Actionable Recommendation**:
  Inspect OLE sector headers or probe for OLE macro stream names (`_VBA_PROJECT`, `VBA`, `dir`) before approving legacy `.xls` uploads.

---

### [SEC-P1-13] Trailing Data Loss Bug in `noise.ts` for Narrow Tables (1–2 Columns)
- **Severity**: **Medium**
- **STRIDE Category**: Data Integrity / Tampering
- **Target**: `packages/engine/src/normalise/noise.ts` (lines 54–68, 83–94)
- **Description**:  
  In `isFootnoteRow`:
  ```typescript
  const fillRatio = filledCells.length / Math.max(totalColumns, 1);
  if (fillRatio > 0.4 && totalColumns > 2) {
    return false;
  }
  ...
  // Single cell long descriptive footnote (> 30 characters) at low fill ratio
  if (filledCells.length === 1 && typeof filledCells[0] === 'string' && firstText.length > 30) {
    return true;
  }
  ```
  Notice that `fillRatio > 0.4` check requires `totalColumns > 2`. In single-column or two-column datasets (e.g. feedback lists, descriptions, comments):
  - `totalColumns <= 2`, so the `fillRatio > 0.4` early-return is skipped.
  - Any single cell where `firstText.length > 30` returns `true` (isFootnoteRow).
  - In `removeNoiseRows`, the bottom-trim loop drops all trailing rows where `isFootnoteRow` returns true.
  - Valid user data records at the bottom of the table are permanently erased!
- **Vulnerability Impact**: Silent truncation and loss of valid user records in narrow (1–2 column) tables.
- **Actionable Recommendation**:
  Ensure footnote heuristics require `totalColumns > 2` before treating long strings as footnotes, or require matching known footnote patterns:
  ```typescript
  if (totalColumns <= 2) {
    return FOOTNOTE_PATTERN.test(firstText);
  }
  ```

---

### [SEC-P1-14] Insecure Pseudo-Random PRNG in `generateSafeEntityId`
- **Severity**: **Low**
- **STRIDE Category**: Spoofing / Information Disclosure
- **Target**: `packages/engine/src/normalise/sheet.ts` (lines 20–25)
- **Description**:  
  In `sheet.ts`:
  ```typescript
  export function generateSafeEntityId(prefix: string): SafeEntityId {
    const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
    const entropy = Math.random().toString(36).substring(2, 10);
    const candidate = `${cleanPrefix}_${entropy}`;
    return SafeEntityIdSchema.parse(candidate);
  }
  ```
  `Math.random()` generates pseudorandom numbers with at most ~41 bits of entropy. It is not cryptographically secure and violates the architectural guideline requiring cryptographically secure randomness for entity generation.
- **Vulnerability Impact**: Predictable entity identifiers; potential ID collision in concurrent environments.
- **Actionable Recommendation**:
  Replace `Math.random()` with `crypto.getRandomValues()` or `crypto.randomUUID()`:
  ```typescript
  const randomBytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(randomBytes);
  const entropy = Array.from(randomBytes, (b) => b.toString(36)).join('').slice(0, 8);
  ```

---

### [SEC-P1-15] Untrimmed Cell Values in `normaliseCellValue` Violating Fixture Specification
- **Severity**: **Low**
- **STRIDE Category**: Data Inconsistency
- **Target**: `packages/engine/src/normalise/cell.ts` (lines 11–17)
- **Description**:  
  In `normaliseCellValue`:
  ```typescript
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return null;
    }
    return raw;
  }
  ```
  `normaliseCellValue` trims the string to test if it is empty, but returns the untrimmed `raw` string. Golden Fixture 24 (`24_whitespace_messy.golden.json`) explicitly defines:
  > *"Messy untrimmed whitespace and tab characters in headers and cell values stripped during normalisation"*
  Because `normaliseCellValue` returns `raw`, running the pipeline on messy whitespace sheets fails to strip trailing and leading tabs/spaces in cell values.
- **Vulnerability Impact**: Data cleaning specification failure; leading tabs (`\t`) in cell values remain present and can become CSV formula injection vectors.
- **Actionable Recommendation**:
  Return `trimmed` instead of `raw`:
  ```typescript
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed === '' ? null : trimmed;
  }
  ```

---

### [SEC-P1-16] Negative Coordinates and Out-of-Bounds Indexing on Malformed SheetJS `!ref`
- **Severity**: **Low**
- **STRIDE Category**: Denial of Service / Bounds Check
- **Target**: `packages/engine/src/parse/sheetjs.ts` (lines 88–120)
- **Description**:  
  When `ws['!ref']` is empty (`""`) or invalid, `XLSX.utils.decode_range(ws['!ref'])` returns `{ s: { c: -1, r: -1 }, e: { c: -1, r: -1 } }`.
  In `sheetjs.ts`:
  ```typescript
  const rowCount = Math.max(0, range.e.r - range.s.r + 1); // Math.max(0, -1 - (-1) + 1) = 1
  const colCount = Math.max(0, range.e.c - range.s.c + 1); // 1
  ...
  const sheetRowIdx = range.s.r + r; // -1 + 0 = -1
  const cellAddr = XLSX.utils.encode_cell({ r: sheetRowIdx, c: sheetColIdx });
  ```
  This computes negative coordinates (`r: -1, c: -1`), calling `encode_cell` with invalid values and querying `ws['INVALID0']`.
- **Vulnerability Impact**: Logic flaw resulting in phantom 1x1 grids on malformed sheets.
- **Actionable Recommendation**:
  Validate that `range.s.r >= 0 && range.s.c >= 0 && range.e.r >= range.s.r && range.e.c >= range.s.c`. If invalid, treat the sheet as empty.

---

## 4. Threat Mitigation Verification Matrix

| Mitigation ID & Title | Invariant / Target Requirement | Enforcement Status | Phase 1 Audit Finding |
|---|---|---|---|
| **Mitigation 1**: Upload Size & Zip-Bomb Defense | 10MB raw cap, 200MB uncompressed, 100:1 ratio, 20 sheets, 200k rows, 200 cols | **PARTIAL** | Ratio check bypassed when `compressedSize === 0` (**SEC-P1-02**); aggregate multi-sheet memory exhaustion (**SEC-P1-06**); lying headers bypass pre-inspection (**SEC-P1-01**). |
| **Mitigation 2**: XML Entity Expansion Neutralization | `doctype: false`, `nodeProcess: false` in SheetJS reader | **FAILED** | Options missing from `XLSX.read()` (**SEC-P1-05**). |
| **Mitigation 3**: Formula Execution Sandbox | Cached values (`cell.v`) only; zero runtime formula evaluation | **ENFORCED** | Verified. `sheetjs.ts` sets `cellFormula: false` and extracts only `cell.v`. Formulas (`cell.f`) never evaluated. |
| **Mitigation 4**: Prototype Pollution Defense | Strip `__proto__`, `constructor`, `prototype`; `Object.create(null)` row records | **PARTIAL** | Column headers sanitized to `safe___proto__`; however, `Object.assign({}, record)` restores `Object.prototype` (**SEC-P1-09**), and `SheetModel.name` accepts prototype keys (**SEC-P1-10**). |
| **Mitigation 5**: Formula Injection Neutralization in Exports | Prepends `'` on `=, +, -, @, \t, \r, \|` in exports | **ENFORCED (Contracts)** | Verified in `packages/contracts/src/export.ts` (`neutralizeFormula`). Row data stores literal strings as designed. |
| **Mitigation 6**: Macro Prohibition | Reject `.xlsm`, `.xlsb`, and embedded VBA macro streams | **PARTIAL** | Excel 4.0 XLM paths (`xl/macroSheets/`) and backslashes bypass regex (**SEC-P1-03**); `.xlsb` extension bypass (**SEC-P1-04**); legacy OLE uninspected (**SEC-P1-12**). |

---

## 5. Review of Test Corpora & Adversarial Red-Team Results

### Golden Baselines & Fixtures Evaluation
1. **Hostile Formulas Fixture (#25)**: Validates that adversarial formula strings (`=cmd|' /C calc'!A0`, `@SUM`, `+HYPERLINK`, `\t=1+1`) are ingested strictly as literal text strings without runtime evaluation.
2. **Formula Cached vs Uncached (#19, #20)**: Validates that pre-computed cached values are preserved, while uncalculated formulas safely yield `null`.
3. **Fixture Generator Desynchronization**: In `packages/fixtures/src/generators/advanced.ts`, `generate25HostileFormulas()` defines worksheet name `'Security_Test'` with headers `['submission_id', 'author', 'feedback_text', 'severity_level']`, whereas the golden baseline `25_hostile_formulas.golden.json` expects sheet name `'User_Submissions'` and headers `['Submission ID', 'User Handle', 'Feedback Text', 'Priority Code']`. This desynchronization should be reconciled.

### Adversarial Red-Team Suite Analysis
The red-team test suite in `packages/engine/test/adversarial/adversarial.test.ts` successfully reproduced and verified key security vulnerabilities:
- `ADV-V1-01`: Confirmed division-by-zero bypass in compression ratio checking.
- `ADV-V2-02`: Confirmed silent loop termination on corrupted Central Directory headers.
- `ADV-V3-01`: Confirmed prototype pollution acceptance in `SheetModel.name`.
- `ADV-V3-03`: Confirmed unhandled `TypeError` crash on null-prototype cells.
- `ADV-V6-01` & `ADV-V6-02`: Confirmed macro pattern bypasses via backslashes and Excel 4.0 XML paths.

---

## 6. Conclusion & Priority Next Steps

Phase 1 establishes robust fundamentals for formula safety and column key prototype sanitization. However, the identified vulnerabilities in ZIP inspection, macro detection, aggregate memory bounds, and XML reader configuration must be addressed before proceeding to Phase 2.

### Prioritized Remediation Roadmap:
1. **Immediate P0 Fixes (Pre-Phase 2 Gate)**:
   - Fix compression ratio bypass when `compressedSize === 0` (**SEC-P1-02**).
   - Expand `MACRO_ENTRY_PATTERNS` to catch `xl/macroSheets/`, normalized backslashes, and `xl/workbook.bin` (**SEC-P1-03**, **SEC-P1-04**).
   - Add `doctype: false`, `nodeProcess: false`, and `bookVBA: false` to `XLSX.read` in `sheetjs.ts` (**SEC-P1-05**).
   - Replace silent `break` with `throw new CorruptedFileError` on invalid Central Directory signatures (**SEC-P1-07**).
2. **High Priority P1 Fixes**:
   - Enforce aggregate workbook cell and row limits (`MAX_WORKBOOK_TOTAL_CELLS = 5_000_000`) (**SEC-P1-06**).
   - Bound merge ranges in SheetJS (`MAX_MERGE_RANGES = 10_000`) (**SEC-P1-08**).
   - Remove `Object.assign({}, record)` in `sheet.ts` and maintain pure `Object.create(null)` row records (**SEC-P1-09**).
   - Defend against `String(val)` crashes in `header.ts` on null-prototype cell values (**SEC-P1-11**).
   - Sanitize sheet names against prototype keywords in `SheetModel` (**SEC-P1-10**).
3. **P2 Quality & Data Integrity Improvements**:
   - Correct trailing footnote stripping logic in `noise.ts` for 1- and 2-column tables (**SEC-P1-13**).
   - Fix `normaliseCellValue` to return trimmed strings (**SEC-P1-15**).
   - Replace `Math.random` with CSPRNG in `generateSafeEntityId` (**SEC-P1-14**).
   - Add negative coordinate guards in `sheetjs.ts` (**SEC-P1-16**).
