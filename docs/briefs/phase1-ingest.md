# Task Brief: Phase 1 - Ingest, Parse & Normalise Engine

## Agent
`ingest-engineer`

## Goal
Implement the core spreadsheet parser and normalisation pipeline in `packages/engine/src/{parse,normalise}`, strictly conforming to `packages/contracts`. The engine must run in pure TypeScript with zero DOM access, suitable for Web Worker execution and Node.

## Owned Paths
- `packages/engine/src/parse/**`
- `packages/engine/src/normalise/**`
- `packages/engine/test/**`

## Security & Architectural Constraints
1. **Upload Safety Guards**:
   - File size cap: <=10 MB (`MAX_FILE_SIZE_BYTES`).
   - Magic byte validation: Check file headers (e.g. `PK\x03\x04` for ZIP/XLSX, ASCII/UTF-8 for CSV). Reject `.xlsm` / `.xlsb` macro formats.
   - Zip Bomb Mitigations: Max uncompressed bytes <=200 MB, max compression ratio <=100:1, max sheets <=20, max rows <=200,000, max columns <=200. Fail closed before full processing if bounds exceeded.
2. **SheetJS Security Rule**:
   - Install SheetJS strictly from `https://cdn.sheetjs.com/` vendor tarball (`xlsx-*.tgz`), NOT from the stale npm registry build.
   - Pinned version with hash verification.
3. **Pure TypeScript Engine**:
   - Zero DOM / window / document access. Must execute in Node and Web Worker environments.
   - Read cached formula values only (`v` property in SheetJS cell); never evaluate formulas or resolve external links / DDE.
   - Ignore embedded OLE objects.
4. **Header Detection & Normalisation**:
   - Automatic header row detection: heuristics based on string density, non-empty ratio, type transition from row to subsequent data rows.
   - Merge handling: forward-fill top-left value across merged header blocks (e.g. multi-tier category headers).
   - Noise removal: Identify and strip empty spacer rows, subtotal rows (rows starting with "total", "subtotal", "sum", "average"), and footer/footnote notes.
   - Key sanitisation: Convert raw header labels into unique `SafeIdentifier` keys (alphanumeric + underscore, starting with letter/underscore), strictly rejecting or neutralizing prototype pollution keys (`__proto__`, `constructor`, `prototype`). Disambiguate duplicate headers with sequential suffixes (`status`, `status_1`).
5. **Output**:
   - Returns a validated `WorkbookModel` conforming to `@unsheet/contracts`.

## Required Testing
- Unit tests for all parser guards, magic byte checks, and normalisation routines.
- Property-based tests (`fast-check`) verifying:
  - Normaliser never throws on arbitrary 2D grid inputs.
  - Output column keys are always unique and safe identifiers.
  - Row count never increases during normalisation.
  - Header detection is idempotent.
- Security tests:
  - Zip bomb rejection.
  - Prototype pollution headers neutralized (`__proto__`, `constructor`, `prototype`).
  - Macro files (`.xlsm`) rejected.
  - Truncated and corrupted spreadsheet files fail closed with clean, informative errors.

## Acceptance Criteria
- Full conformity to `@unsheet/contracts` `WorkbookModelSchema`.
- Vitest tests pass with >=90% line coverage and >=85% branch coverage on parser and normaliser.
- Property tests and security tests pass.
- Handoff note written at `docs/handoffs/phase1-ingest-engineer.md`.
