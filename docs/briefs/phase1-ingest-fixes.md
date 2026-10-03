# Task Brief: Phase 1 Ingest & Normalise Engine Remediation

**Agent**: `ingest-engineer`  
**Branch**: `agent/ingest/phase1-fixes`  
**Owned Paths**:
- `packages/engine/src/parse/**`
- `packages/engine/src/normalise/**`
- `packages/engine/test/**`
- `packages/engine/tsconfig.json`

## Goal
Remediate all blocking findings from Phase 1 security audit (`docs/reviews/security-phase1.md`), code review (`docs/reviews/code-review-phase1.md`), and red-team tests (`docs/reviews/adversarial-phase1.md`).

## Requirements

### 1. Verification & Compiler Fixes
- In `packages/engine/test/adversarial/adversarial.test.ts`, remove the 5 unused imports (`MAX_UNCOMPRESSED_BYTES`, `MAX_ROWS`, `MAX_COLUMNS`, `normaliseWorkbook`, `SheetBoundsError`) so `pnpm lint` passes with 0 warnings/errors (`REV-P1-01`).
- In `packages/engine/tsconfig.json`, update `"include"` to `["src/**/*", "test/**/*"]` so tests are included in `tsc --noEmit` (`REV-P1-02`).

### 2. Parse & ZIP Security Hardening
- **Macro Guards** (`SEC-P1-03`, `ADV-P1-01`, `ADV-P1-02`, `SEC-P1-04`):
  - In `packages/engine/src/parse/guards.ts`: reject `.xlm` and `.xla` extensions in addition to `.xlsm` and `.xlsb`.
  - In `packages/engine/src/parse/zip.ts`:
    - Normalize all entry filenames with `filename.replace(/\\/g, '/')`.
    - Expand `MACRO_ENTRY_PATTERNS` to catch:
      - `/xl\/(?:macros|macroSheets)\//i`
      - `/macroSheet/i`
      - `/xl\/workbook\.bin/i` (catches disguised `.xlsb`)
      - `/vbaProject\.bin/i`
- **ZIP Bomb Hardening** (`SEC-P1-02`, `REV-P1-13`, `ADV-P1-04`):
  - In `packages/engine/src/parse/zip.ts`: if `uncompressedSize > 0 && compressedSize === 0`, treat as suspicious compression and throw `ZipBombError` (or `UploadGuardError`).
- **Central Directory Integrity** (`SEC-P1-07`, `ADV-P1-11`):
  - In `packages/engine/src/parse/zip.ts`: if a central directory entry header signature is not `0x02014b50`, throw `UploadGuardError` ('Corrupted Central Directory entry') instead of silently breaking the loop.
- **SheetJS Reader Hardening** (`SEC-P1-05`, `ADV-P1-06`, `ADV-P1-07`):
  - In `packages/engine/src/parse/sheetjs.ts`: pass `doctype: false`, `nodeProcess: false` to `XLSX.read(...)`.
  - Check `Object.hasOwn(workbook.Sheets, sheetName)` before accessing sheet dictionary.
  - Reject or sanitize sheet names matching `__proto__`, `constructor`, `prototype`.

### 3. Normalisation Engine Fixes
- **Prototype-Safe String Conversion** (`ADV-P1-07`):
  - In `packages/engine/src/normalise/cell.ts` (and wherever `String(val)` is called on arbitrary input): define and use `safeToString(val: unknown): string` that gracefully handles `Object.create(null)` without throwing `TypeError: Cannot convert object to primitive value`.
- **String Cell Whitespace Trimming** (`REV-P1-06`):
  - In `packages/engine/src/normalise/cell.ts`: return `trimmed` instead of `raw` for string cells.
- **Subtotal Row Stripping** (`REV-P1-03`):
  - In `packages/engine/src/normalise/noise.ts`: update `SUBTOTAL_PATTERN` to match category subtotals (e.g. `/(?:^|\s)(?:total|subtotal|sub-total|grand\s*total|sum|average|avg)\b/i`).
  - Scan across the cells in the row rather than immediately breaking on the first non-empty cell.
- **Empty Spacer Column Pruning** (`REV-P1-04`):
  - In `packages/engine/src/normalise/sheet.ts` and `header.ts`: prune columns where header is empty/null/fallback AND all data row values in that column are null/empty.
- **Multi-Row Header Combination** (`REV-P1-05`):
  - In `packages/engine/src/normalise/header.ts`: when `detectedRowIndex > 0` and the preceding row contains section/category labels (e.g. `Location`, `Q1 Figures`), combine the parent label with the child subheader (`Location - City` -> `location_city`, `Q1 Figures - Target` -> `q1_figures_target`).
- **Footnote Edge Case** (`REV-P1-10`):
  - In `packages/engine/src/normalise/noise.ts`: in `isFootnoteRow`, check that `totalColumns > 1` before assuming a single text cell is a footnote.
- **Memory & Allocation Optimizations** (`REV-P1-07`, `REV-P1-08`, `REV-P1-09`):
  - Allocate a single plain object per row: `const record: Record<SafeIdentifier, unknown> = {}` directly, since keys are verified `SafeIdentifier`.
  - In `merge.ts`: only clone rows within affected merge bounds.

## Verification
1. Run `pnpm --filter @unsheet/engine test` (all unit, property, and adversarial tests must pass).
2. Run `pnpm verify` (lint + typecheck + test + build + secret scan + audit must pass 100%).

## Handoff
Write report to `docs/handoffs/phase1-ingest-fixes.md` and commit to `agent/ingest/phase1-fixes`.
