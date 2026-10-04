# Phase 6 Safe Export Engine Handoff

## Overview
Implemented Phase 6 Safe Export Engine in `packages/engine` (`packages/engine/src/export/**`) and re-exported robust export utilities supporting CSV, JSON, and XLSX formats with strict formula injection protection, RFC 4180 compliance, and prototype pollution rejection via `@unsheet/contracts`.

## Implemented Modules
1. **CSV Export (`packages/engine/src/export/csv.ts`)**:
   - `exportToCsv(table: ExportTable, options?: Partial<ExportOptions>): string`
   - Validates tables using `ExportTableSchema.safeParse`.
   - Neutralizes string cells and headers against formula triggers (`FORMULA_TRIGGER_REGEX`: `=`, `+`, `-`, `@`, `\t`, `\r`, `\n`, `|`) by prepending `'`.
   - Complies with RFC 4180 quoting and escaping rules (quoting fields containing commas, double quotes, or newlines, escaping quotes as `""`).
   - Supports both `Record<string, unknown>` and `Array<unknown>` row structures.
   - Joins rows with `\r\n`.

2. **JSON Export (`packages/engine/src/export/json.ts`)**:
   - `exportToJson(table: ExportTable): string`
   - Validates input and serializes sanitized row objects/arrays into formatted JSON string (`JSON.stringify(..., null, 2)`).

3. **XLSX Export (`packages/engine/src/export/xlsx.ts`)**:
   - `exportToXlsx(table: ExportTable, options?: Partial<ExportOptions>): Uint8Array`
   - Builds SheetJS array-of-arrays (AOA) with header row and data rows.
   - Enforces cell type `'s'` and neutralizes formula-trigger strings.
   - Returns a compiled `Uint8Array` binary buffer.

4. **Re-exports (`packages/engine/src/export/index.ts` & `packages/engine/src/index.ts`)**:
   - Exported all export functions with correct `.js` relative extensions.

5. **Testing (`packages/engine/test/export/export.test.ts`)**:
   - Comprehensive unit tests covering hostile cells (`=cmd|...`, `=HYPERLINK(...)`, `+12345`, `-999`, `@SUM(...)`, `\t=danger`, `|pipe`), JSON export, XLSX binary generation, and property-based testing with `fast-check`.

## Verification Status
- `pnpm --filter @unsheet/engine test` -> All 28 test suites passed successfully (279 tests).
- `pnpm lint --quiet` -> 0 errors.
- `pnpm -r exec tsc --noEmit` -> 0 type errors across all packages.
