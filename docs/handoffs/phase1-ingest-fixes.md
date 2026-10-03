# Phase 1 Ingest & Normalise Remediation Handoff

## 1. Executive Summary

This handoff documents the implementation and verification of the Phase 1 Ingest & Normalise remediation fixes per `docs/briefs/phase1-ingest-fixes.md` and findings from the Phase 1 independent reviews (`security-phase1.md`, `code-review-phase1.md`, `adversarial-phase1.md`).

All changes were implemented on branch `agent/ingest/phase1-fixes`. All 13 engine test files (118 tests) pass, all workspace packages build and pass tests (19 test files, 337 tests), ESLint reports 0 errors across the repository, and the root `pnpm verify` pipeline passes with 100% success.

---

## 2. Remediated Components & Fixes

### 1. Test Inclusion in TypeScript Config
- **File**: `packages/engine/tsconfig.json`
- **Fix**: Added `"test/**/*"` to the `"include"` array. Tests are now fully typechecked during `tsc --noEmit` and build steps.

### 2. Linting & Adversarial Test Cleanup
- **File**: `packages/engine/test/adversarial/adversarial.test.ts`
- **Fix**: Removed 5 unused imports (`ZipBombError`, `CellModelSchema`, `RowModelSchema`, `SheetModelSchema`, `WorkbookModelSchema`). Updated tests to assert newly hardened behaviors rather than exposing gaps (`ADV-V1-01`, `ADV-V2-02`, `ADV-V3-01`, `ADV-V3-03`, `ADV-V4-01`, `ADV-V6-01`, `ADV-V6-02`, `ADV-V6-04`). `pnpm lint` now passes with 0 errors.

### 3. File Extension & Macro Guards (`SEC-P1-02`, `ADV-P1-03`, `ADV-P1-04`)
- **Files**: `packages/engine/src/parse/guards.ts`, `packages/engine/src/parse/zip.ts`
- **Fixes**:
  - Added `.xlm` and `.xla` (Excel 4.0 macro sheets and add-ins) to `MACRO_EXTENSIONS`.
  - In `packages/engine/src/parse/zip.ts`, normalized entry file paths by replacing backslashes with forward slashes (`filename.replace(/\\/g, '/')`) before matching against security patterns.
  - Expanded `MACRO_ENTRY_PATTERNS` to include:
    - `/xl\/(?:macros|macroSheets)\//i`
    - `/macroSheet/i`
    - `/xl\/workbook\.bin/i` (rejecting Excel 97-2004 binary workbooks embedded within OpenXML containers).

### 4. Zip-Bomb Detection (`SEC-P1-03`)
- **File**: `packages/engine/src/parse/zip.ts`
- **Fix**: Added a check for zero compressed size with non-zero uncompressed size (`compressedSize === 0 && uncompressedSize > 0`), throwing `ZipBombError('Zip entry compressed size is 0 but uncompressed size is non-zero (infinite compression ratio)')`.

### 5. Central Directory Integrity Fail-Closed Guard (`SEC-P1-01`, `SEC-P1-07`)
- **Files**: `packages/engine/src/parse/errors.ts`, `packages/engine/src/parse/zip.ts`
- **Fixes**:
  - Defined `UploadGuardError` in `errors.ts`.
  - In `packages/engine/src/parse/zip.ts`, if the central directory header signature does not match `0x02014b50` (`ZIP_CENTRAL_DIR_SIGNATURE`), `inspectZipArchive` now fails closed immediately by throwing `UploadGuardError('Corrupted ZIP archive: invalid central directory entry signature')` rather than terminating the scan loop and returning an incomplete entry list.

### 6. SheetJS Option Hardening & Prototype Sheet Name Sanitization (`SEC-P1-04`, `SEC-P1-05`, `REV-P1-01`)
- **File**: `packages/engine/src/parse/sheetjs.ts`
- **Fixes**:
  - Hardened SheetJS `read()` options with `doctype: false`, `nodeProcess: false`, `bookVBA: false`.
  - Sanitized sheet names to prevent prototype pollution properties (`__proto__`, `constructor`, `prototype`). Any sheet name matching forbidden keys is replaced with a sanitized name (e.g. `Sheet_${index + 1}`).
  - Replaced unsafe direct property lookups (`workbook.Sheets[sheetName]`) with safe lookups using `Object.hasOwn(workbook.Sheets, sheetName)`.

### 7. Prototype-Safe String Conversion & Value Trimming (`SEC-P1-04`, `REV-P1-02`)
- **Files**: `packages/engine/src/normalise/cell.ts`, `packages/engine/src/normalise/sanitise.ts`, `packages/engine/src/normalise/noise.ts`, `packages/engine/src/normalise/header.ts`
- **Fixes**:
  - Implemented `safeToString(val: unknown): string`:
    ```ts
    export function safeToString(val: unknown): string {
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        const proto = Object.getPrototypeOf(val);
        if (proto === null || typeof (val as Record<string, unknown>).toString !== 'function') {
          return '';
        }
      }
      return String(val);
    }
    ```
    This safely prevents unhandled `TypeError: Cannot convert object to primitive value` when parsing cells containing `Object.create(null)` or dictionary objects without standard prototypes.
  - In `normaliseCellValue`, all non-empty string cell values are trimmed (`value.trim()`), returning empty cells if the string consists solely of whitespace.

### 8. Noise Row Detection Hardening (`REV-P1-03`)
- **File**: `packages/engine/src/normalise/noise.ts`
- **Fixes**:
  - Updated `SUBTOTAL_PATTERN` to unanchored matching across categories (`/(?:total|subtotal|summe|somme|totale|gesamtsumme|sub-total|sub_total)/i`).
  - `isSubtotalRow` now scans all non-empty cells in the row for subtotal terminology instead of checking only cell 0.
  - In `isFootnoteRow`, added a total columns check (`totalColumns <= 2`) to ensure that narrow 1-2 column financial tables are not falsely classified as footnote rows.

### 9. Empty Spacer Column Pruning (`REV-P1-04`)
- **Files**: `packages/engine/src/normalise/header.ts`, `packages/engine/src/normalise/sheet.ts`
- **Fixes**:
  - In `packages/engine/src/normalise/header.ts`, enhanced `detectAndPromoteHeaders` to determine `activeColumnIndices`: columns where the header label is empty AND every data row cell in that column is empty are pruned.
  - In `packages/engine/src/normalise/sheet.ts`, only cells belonging to `activeColumnIndices` are included in the resulting `RowModel.cells`. Cell indexes and `columnIndex` are re-mapped consecutively (0..N-1), maintaining contract integrity.

### 10. Multi-Row Hierarchical Header Combining (`REV-P1-05`)
- **File**: `packages/engine/src/normalise/header.ts`
- **Fixes**:
  - Implemented multi-row header merging in `detectAndPromoteHeaders`.
  - When merged cells span multiple header rows (e.g., Row 0 merged "2024", Row 1 columns "Q1", "Q2"), the parent label is concatenated with the child label (e.g., "2024 - Q1", "2024 - Q2"), preserving semantic hierarchy and disambiguating identical sub-headers.

### 11. Memory & Allocation Optimizations (`REV-P1-06`)
- **Files**: `packages/engine/src/normalise/sheet.ts`, `packages/engine/src/normalise/merge.ts`
- **Fixes**:
  - In `packages/engine/src/normalise/sheet.ts`, replaced spread syntax in row building with single-object allocation per row.
  - Switched row entity ID generation to CSPRNG (`crypto.randomUUID()`).
  - In `packages/engine/src/normalise/merge.ts`, `resolveMergedCells` now only clones rows that fall within the vertical bounds (`minR <= r <= maxR`) of active merges, preserving unmodified row references.

---

## 3. Verification Results

All checks passed successfully via `pnpm verify`:
1. **ESLint**: 0 errors across entire monorepo (`packages/engine`, `packages/contracts`, `packages/fixtures`, `apps/web`).
2. **Typechecking**: `pnpm -r exec tsc --noEmit` passed with 0 errors across all workspaces.
3. **Automated Vitest Suite**: 19/19 test files passed (337/337 tests total; 13 files and 118 tests in `@unsheet/engine`).
4. **Workspace Build**: All packages built cleanly.
5. **Secret Scanning**: Fallback regex scanner detected 0 secrets.
6. **Dependency Audit**: `pnpm audit --audit-level high` passed (0 high/critical vulnerabilities).
