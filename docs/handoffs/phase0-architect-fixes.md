# Phase 0 Architecture & Contracts Review Fixes Handoff

## 1. Executive Summary

All security and code review findings identified in Phase 0 contracts have been resolved, thoroughly verified, and covered with automated tests. The `@unsheet/contracts` package now enforces zero raw data egress to external LLMs, client-side input sanitization against formula injection and prototype pollution, ingestion and payload bounds against denial of service, safe SQL parsing for DuckDB-WASM query generation, safe URL scheme validation, and dedicated export sanitization models.

All checks in `pnpm verify` pass with zero errors and zero warnings across all workspace packages.

---

## 2. Review Findings Resolved & Architectural Fixes

### 1. SEC-01 & REV-P0-05: LLM Data Boundary & Formula Sanitization in Profiles
- **Location**: `packages/contracts/src/profile.ts`, `packages/contracts/src/api.ts`
- **Mitigation Applied**:
  - In `profile.ts`, updated `CategoryFrequencySchema.value` to cap character length at 100 and enforce formula trigger rejection: `!/^[=+\-@\t\r\n|]/.test(val.trimStart())`.
  - Defined and exported `LLMColumnProfileSchema = ColumnProfileSchema.omit({ topValues: true })`, strictly preventing raw categorical value exfiltration to LLMs while preserving capped sample values (`sampleValues <= 5` items, `<= 40` chars each).
  - Updated `SpecRefinementRequestSchema.shape.profiles` and `AskYourDataRequestSchema.shape.profiles` in `api.ts` to reference `LLMColumnProfileSchema`.

### 2. SEC-02: Client-Supplied `system` Role Injection Defense
- **Location**: `packages/contracts/src/api.ts`
- **Mitigation Applied**:
  - Restructured `ChatMessageSchema.shape.role` to `z.enum(['user', 'assistant'])`.
  - Strictly rejects client-supplied `'system'` role messages in conversation history, guaranteeing that system prompts and guardrails can only be injected by trusted server-side route handlers.

### 3. SEC-03, ADV-P0-02, REV-P0-08: Hardened Formula Injection Neutralization
- **Location**: `packages/contracts/src/common.ts`
- **Mitigation Applied**:
  - Hardened `SampleValueSchema` to reject leading whitespace, newlines, and pipe characters before formula triggers:
    `!/^[=+\-@\t\r\n|]/.test(val) && !/^[=+\-@\t\r\n|]/.test(val.trimStart())`.
  - Prevents bypasses using `" =cmd"`, `"\n=1+1"`, `"\t=cmd"`, and `"|cmd|' /C calc'!A0"`.

### 4. SEC-04, ADV-P0-06: Ingestion Limits & Memory Bounds
- **Location**: `packages/contracts/src/workbook.ts`, `docs/SPEC.md`, `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`
- **Mitigation Applied**:
  - Exported canonical ingestion limit constants in `workbook.ts`:
    - `MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024` (10 MB upload cap)
    - `MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024` (200 MB uncompressed cap)
    - `MAX_ROWS = 200_000` (max 200,000 rows per sheet)
    - `MAX_COLUMNS = 200` (max 200 columns per sheet)
    - `MAX_SHEETS = 20` (max 20 sheets per workbook)
  - Enforced `.max()` bounds on `WorkbookModelSchema.fileSize` (`MAX_FILE_SIZE_BYTES`), `WorkbookModelSchema.sheets` (`MAX_SHEETS`), `SheetModelSchema.rows` (`MAX_ROWS`), `SheetModelSchema.columns` (`MAX_COLUMNS`), `SheetModelSchema.rowCount` (`MAX_ROWS`), and `SheetModelSchema.columnCount` (`MAX_COLUMNS`).
  - Synchronized documentation in `SPEC.md`, `ARCHITECTURE.md`, and `THREAT_MODEL.md` to reflect these exact limits.

### 5. SEC-05, REV-P0-10: Safe SQL AST Query Schema
- **Location**: `packages/contracts/src/query.ts`, `packages/contracts/src/api.ts`
- **Mitigation Applied**:
  - Authored `SafeSqlQuerySchema` in `query.ts` validating that queries are single read-only analytical statements:
    - Must begin with `SELECT` or `WITH`.
    - Prohibits multi-statement queries (chained semicolons with executable text).
    - Prohibits DDL/DML and administrative commands (`DROP`, `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CREATE`, `COPY`, `ATTACH`, `DETACH`, `INSTALL`, `LOAD`, `PRAGMA`).
    - Prohibits dangerous file functions (`read_csv`, `read_csv_auto`, `read_parquet`, `read_json`, `scan_parquet`, `parquet_scan`, `write_csv`, `write_parquet`, `read_blob`, `read_text`).
    - Literal regexes used to comply with ESLint `security/detect-non-literal-regexp`.
  - Bound `AskYourDataResponseSchema.shape.sql` to `SafeSqlQuerySchema.optional()`.
  - Constrained `QueryFilterSchema.value` to scalar primitives and primitive arrays via `QueryFilterValueSchema`.

### 6. SEC-06: Dedicated Export Contracts Module
- **Location**: `packages/contracts/src/export.ts`, `packages/contracts/src/index.ts`
- **Mitigation Applied**:
  - Created `packages/contracts/src/export.ts` and re-exported from `index.ts`.
  - Authored `SafeExportCellSchema` implementing automated formula neutralization: prepends `'` to any string cell beginning with `=, +, -, @, \t, \r, \n, |` (after leading whitespace trimming) and enforces finite numbers.
  - Authored `ExportColumnKeySchema` rejecting prototype pollution keys while supporting human-readable column headers with spaces.
  - Authored `ExportRowSchema` supporting both object records and flat CSV arrays.
  - Authored `ExportTableSchema`, `ExportFormatSchema`, and `ExportOptionsSchema`.

### 7. REV-P0-03, ADV-P0-01: Share URL Protocol Validation
- **Location**: `packages/contracts/src/common.ts`, `packages/contracts/src/api.ts`
- **Mitigation Applied**:
  - Authored `SafeUrlSchema` in `common.ts` requiring `http:` or `https:` URL protocols.
  - Strictly rejects dangerous URI schemes: `javascript:`, `data:`, `file:`.
  - Applied `SafeUrlSchema` to `CreateShareLinkResponseSchema.shape.shareUrl`.

### 8. REV-P0-04, ADV-P0-05: Horizontal Grid Boundary Validation
- **Location**: `packages/contracts/src/spec.ts`
- **Mitigation Applied**:
  - Added refinement to `WidgetGridPositionSchema`:
    `.refine((pos) => pos.x + pos.w <= 12, { message: 'Widget position x + w must not exceed 12 grid columns' })`.
  - Prevents horizontal overflow in responsive 12-column grid layouts.

### 9. REV-P0-09, ADV-P0-04: Prototype Pollution Defense in Entity Identifiers
- **Location**: `packages/contracts/src/common.ts`, `spec.ts`, `workbook.ts`, `template.ts`, `profile.ts`, `query.ts`
- **Mitigation Applied**:
  - Defined `SafeEntityIdSchema` in `common.ts` enforcing alphanumeric, hyphen, and underscore characters (`/^[a-zA-Z0-9_-]+$/`, max 64 chars) while strictly rejecting `__proto__`, `constructor`, `prototype`.
  - Updated entity ID fields to use `SafeEntityIdSchema`:
    - `DashboardSpec.id` and `DashboardSpec.sheetBinding`
    - `SheetModel.id` and `WorkbookModel.id`
    - `Template.id`
    - `SheetProfile.sheetId`
    - `QueryPlan.id` and `QueryResult.queryId`

### 10. REV-P0-11: Widget Array Bounds (DoS Defense)
- **Location**: `packages/contracts/src/spec.ts`
- **Mitigation Applied**:
  - Added `.max(50, 'Dashboard exceeds maximum 50 widgets')` to `DashboardSpecSchema.shape.widgets`.

### 11. ADV-P0-08, REV-P0-13: Finite Floating Point Number Enforcement
- **Location**: `packages/contracts/src/profile.ts`, `packages/contracts/src/query.ts`
- **Mitigation Applied**:
  - Added `.finite()` to all fields in `NumericStatsSchema` (`min`, `max`, `mean`, `median`, `sum`, `variance`, `stdDev`).
  - Added `.finite()` to `ColumnProfileSchema.uniquenessRatio` and `CategoryFrequencySchema.percentage`.
  - Added `.finite()` to `QueryResultSchema.executionTimeMs`.
  - Rejects `Infinity`, `-Infinity`, and `NaN`.

---

## 3. Verification & Test Suite Updates

1. **Unit Test Suite (`packages/contracts/test/contracts.test.ts`)**:
   - Expanded from 24 to 36 tests.
   - Added test coverage for `ChatMessageSchema` role enforcement.
   - Added test coverage for `SafeUrlSchema` scheme rejection.
   - Added test coverage for `LLMColumnProfileSchema` topValues omission.
   - Added test coverage for `SafeSqlQuerySchema` keyword, multi-statement, and file-function bans.
   - Added test coverage for `SafeExportCellSchema` formula escaping, `ExportRowSchema`, and `ExportTableSchema`.
   - Added test coverage for `MAX_FILE_SIZE_BYTES` and ingestion limits.
   - Added test coverage for `SafeEntityIdSchema` prototype pollution defense.

2. **Adversarial Red-Team Suite (`packages/contracts/test/adversarial.test.ts`)**:
   - Updated previously exposed gap tests into active assertion tests verifying that all 9 identified attack vectors are now rejected:
     - Prototype pollution in entity IDs (`__proto__`, `constructor`)
     - Whitespace, newline, and pipe formula triggers in `SampleValueSchema`
     - Formula injection in `CategoryFrequencySchema.value`
     - Widget array exhaustion (`> 50` widgets)
     - File size limit breach (`> 10 MB`)
     - Horizontal grid overflow (`x + w > 12`)
     - Dangerous URL schemes in `shareUrl` (`javascript:`, `data:`, `file:`)
     - Non-finite numbers in `NumericStatsSchema` (`Infinity`, `-Infinity`)
     - Non-finite execution time in `QueryResultSchema`

3. **Workspace Verification (`pnpm verify`)**:
   - Step 1 (ESLint + Security Plugin): PASS (0 errors, 0 warnings).
   - Step 2 (Strict Typechecking `tsc --noEmit` across all workspaces): PASS.
   - Step 3 (Vitest 6 test files, 69 tests): PASS (100% pass rate).
   - Step 4 (Build `tsc --noEmit` across all packages): PASS.
   - Step 5 (Secret scanning): PASS (No secrets detected).
   - Step 6 (Dependency audit): PASS (0 high/critical vulnerabilities).

---

## 4. Status for Downstream Engineers

Phase 0 Contracts & Architecture are fully hardened and ready for Phase 1 feature implementation (`@unsheet/engine` parsers, DuckDB integration, UI rendering).
