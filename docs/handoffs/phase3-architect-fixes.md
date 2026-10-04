# Phase 3 Architecture & Contracts Fixes Handoff

## 1. Executive Summary

Phase 3 contract remediations have been implemented on branch `agent/architect/phase3-fixes`, addressing security and adversarial findings **SEC-P3-03** and **ADV-P3-09** regarding SQL query validation in `packages/contracts/src/query.ts`.

All contract schemas and refinements have been implemented in `packages/contracts`, accompanied by comprehensive unit test coverage in `packages/contracts/test/contracts.test.ts`.
Both `pnpm --filter @unsheet/contracts test` and `pnpm --filter @unsheet/contracts build` pass cleanly with zero ESLint warnings/errors and a 100% test pass rate (75/75 tests passed).

---

## 2. Remediated Vulnerabilities & Flaws

### 1. `SafeSqlQuerySchema` Keyword False Positives & Legitimate Quoted Column Acceptance (`ADV-P3-09`)
- **Target**: `packages/contracts/src/query.ts` (`SafeSqlQuerySchema`, `maskSqlLiteralsAndIdentifiers`)
- **Issue**:
  `SafeSqlQuerySchema` previously executed `FORBIDDEN_SQL_KEYWORD_REGEX` directly against the raw SQL string using word-boundary matching `/\b(DROP|...|COPY)\b/i`. When querying spreadsheet columns legitimately named `copy`, `alter`, `create`, `drop`, or `update` (e.g. `SELECT "copy" FROM "sales"`), the query was falsely rejected as forbidden DDL/DML, causing a client-side denial of service.
- **Remediation**:
  Authored and integrated `maskSqlLiteralsAndIdentifiers(sql)`:
  ```ts
  export function maskSqlLiteralsAndIdentifiers(sql: string): string {
    return sql.replace(/'(?:''|[^'])*'|"[^"]*"(?!\s*\()/g, (match) => ' '.repeat(match.length));
  }
  ```
  Double-quoted identifiers (such as `"copy"`, `"alter"`) are masked with whitespace prior to testing against `FORBIDDEN_SQL_KEYWORD_REGEX`. Double-quoted identifiers immediately followed by `\s*\(` are excluded from masking to prevent evading function invocation checks (e.g. `"read_csv"(...)`).
- **Guarantees**:
  - Legitimate quoted column names matching SQL keywords (e.g. `SELECT "copy", "alter" FROM "sales"`) are accepted.
  - Queries referencing quoted columns with names like `"create"`, `"drop"`, `"update"`, `"delete"` are accepted.

### 2. Lexical Awareness of String Literals & Multi-Statement Protection (`SEC-P3-03`)
- **Target**: `packages/contracts/src/query.ts` (`SafeSqlQuerySchema`, `maskSqlLiteralsAndIdentifiers`, `FORBIDDEN_SQL_FUNCTION_REGEX`)
- **Issue**:
  - Benign business data inside single-quoted string literals (e.g. `WHERE status = 'created'`, `WHERE col = 'create'`) falsely triggered `FORBIDDEN_SQL_KEYWORD_REGEX`.
  - String literals containing semicolons (e.g. `WHERE title = 'Phase 1; Phase 2'`) falsely triggered `!/;[\s\S]*\S/.test(sql.trim())`, rejecting valid analytical queries.
  - Dangerous DuckDB functions not in the previous hardcoded function list (such as `read_ndjson`, `scan_csv`, `glob`, `getenv`, `current_setting`, `duckdb_secrets`, `duckdb_settings`) were unhandled by the function denylist.
- **Remediation**:
  - `maskSqlLiteralsAndIdentifiers` replaces standard SQL single-quoted literals (`'(?:''|[^'])*'`) with equivalent whitespace, preserving string layout while defanging internal keywords and semicolons.
  - Multi-statement semicolon check `!/;[\s\S]*\S/.test(masked.trim())` operates on the masked SQL string, permitting semicolons inside string literals and quoted identifiers while strictly rejecting actual multi-statement query sequences.
  - Expanded `FORBIDDEN_SQL_FUNCTION_REGEX` to cover all dangerous file-access, scanning, introspection, and administrative functions:
    ```ts
    const FORBIDDEN_SQL_FUNCTION_REGEX =
      /(?:"|\b)(read_csv|read_csv_auto|read_parquet|read_json|read_json_auto|read_ndjson|read_ndjson_auto|scan_parquet|parquet_scan|scan_csv|scan_json|sniff_csv|write_csv|to_csv|write_parquet|to_parquet|read_blob|read_text|glob|getenv|current_setting|duckdb_secrets|duckdb_settings|duckdb_extensions|duckdb_tables|checkpoint|export_database|query_table)(?:"|\b)\s*\(/i;
    ```
- **Guarantees**:
  - Queries with string literals matching SQL keywords (e.g. `WHERE "col" = 'create'`, `WHERE "status" = 'created'`) are accepted.
  - Semicolons inside string literals (e.g. `WHERE "description" = 'Phase 1; Phase 2'`) and escaped quotes (e.g. `WHERE "note" = 'Don''t drop the table'`) are accepted.
  - Actual DDL/DML outside literals (`CREATE TABLE ...`, `SELECT *; DROP TABLE ...`, `SELECT "copy" FROM "t"; DROP TABLE "t"`) remain strictly rejected.
  - Dangerous DuckDB functions (e.g. `read_csv`, `read_ndjson`, `glob`, `duckdb_secrets`), whether unquoted or double-quoted, remain strictly rejected.

---

## 3. Automated Test Coverage

Updated `packages/contracts/test/contracts.test.ts` under the `Safe SQL Query Contracts` test suite:
1. **Quoted Column Names Matching Keywords (`ADV-P3-09`)**:
   - `SELECT "copy" FROM "t"` -> valid
   - `SELECT "copy", "alter" FROM "sales"` -> valid
   - `SELECT "create", "drop", "update", "delete", "load" FROM "data"` -> valid
   - `SELECT "read_csv" FROM "analytics"` -> valid
2. **String Literals Matching Keywords & Dangerous Functions (`SEC-P3-03`)**:
   - `SELECT "id" FROM "items" WHERE "col" = 'create'` -> valid
   - `SELECT "id" FROM "items" WHERE "status" = 'created'` -> valid
   - `SELECT "id" FROM "items" WHERE "action" = 'drop' AND "state" = 'alter'` -> valid
   - `SELECT "id" FROM "items" WHERE "description" = 'Phase 1; Phase 2'` -> valid
   - `SELECT "id" FROM "items" WHERE "note" = 'Don''t drop the table'` -> valid
   - `SELECT "id" FROM "logs" WHERE "msg" = 'called read_csv(file)'` -> valid
3. **Multi-Statement Rejection Outside Literals**:
   - `SELECT 1; SELECT 2;` -> rejected
   - `SELECT * FROM users; DROP TABLE users;` -> rejected
   - `SELECT "copy" FROM "t"; DROP TABLE "t"` -> rejected
   - `SELECT * FROM items WHERE status = 'create'; DROP TABLE items` -> rejected
   - `SELECT * FROM items WHERE note = 'Don''t drop'; DROP TABLE items;` -> rejected
4. **Actual DDL, DML, and Administrative Operations Rejection**:
   - `CREATE TABLE backdoors (cmd TEXT)` -> rejected
   - `DROP TABLE customers` -> rejected
   - `ALTER TABLE users ADD COLUMN role TEXT` -> rejected
   - `ATTACH "other.db"` / `DETACH "other.db"` / `INSTALL sqlite` / `LOAD sqlite` / `PRAGMA threads=4` -> rejected
5. **Dangerous DuckDB File & Introspection Functions Rejection**:
   - `read_csv`, `"read_csv"`, `read_csv_auto`, `read_parquet`, `scan_parquet`, `read_json`, `read_ndjson`, `read_text`, `glob`, `duckdb_secrets`, `current_setting` -> rejected
6. **Masking Unit Test (`maskSqlLiteralsAndIdentifiers`)**:
   - Preserves exact character count and layout while removing keywords, functions, and semicolons from literal content.

---

## 4. Verification Results

- `pnpm --filter @unsheet/contracts test`:
  - 3 test files (`src/index.test.ts`, `test/adversarial.test.ts`, `test/contracts.test.ts`)
  - 75 tests passed (100% pass rate)
- `pnpm --filter @unsheet/contracts build`:
  - Strict typecheck passed (`tsc --noEmit`, `noUncheckedIndexedAccess: true`)
- `pnpm exec eslint packages/contracts`:
  - 0 errors, 0 warnings
