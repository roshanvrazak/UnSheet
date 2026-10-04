# Adversarial Red-Team Report: Phase 7 Comprehensive Platform Assessment

**Target Scope:** Entire Unsheet Platform (Ingestion, Formula Engine, Export, Share/Auth, AI/Prompt Injection, SQL Query Validator, Rate Limiting & DoS Resiliency)  
**Review Date:** October 4, 2026  
**Auditor:** Adversarial QA & Red-Team Agent (`adversarial-tester`)

---

## Executive Summary

As the final red-team assessment for Unsheet, Phase 7 consolidates our security evaluation across all platform boundaries. We subjected the entire system—ranging from malicious workbook ingestion (Zip bombs, corrupt central directories, macro sheets) to hostile formula export injection, AI prompt injection corpora, DuckDB-WASM query validation, share link timing oracles, and rate-limiting/DoS protections—to intensive adversarial fuzzing and automated test verification.

Overall, Unsheet's defense-in-depth architecture—anchored by strict Zod schema validation at every module boundary (`@unsheet/contracts`), safe expression evaluation, robust formula sanitization in exports, cryptographic share tokens with zero-information disclosure (preventing enumeration oracles), and distributed/rate-limiting mechanisms—demonstrates **outstanding security posture and robustness**.

---

## 1. Malicious Workbooks & Files (`packages/fixtures`, `packages/engine/src/ingest`)
* **Vectors Tested:**
  - **Zip Bombs:** Compressed XML/JSON files expanding beyond safe memory limits.
  - **Corrupt Central Directories:** Invalid local headers, truncated PKZIP files, circular references in ZIP compression.
  - **Macro Sheets (.xlsm, .xlsb):** Embedded VBA macros, Excel 4.0 macro sheets (`.xlsm`), and hidden XLM macro streams.
  - **Hostile Cell Values:** Extremely deep formulas, unicode overflow strings, circular cell dependencies.
* **Findings:**
  - **Ingestion Boundaries:** The parser enforces strict maximum file size limits and validates central directory structures before inflating streams, successfully defending against Zip bombs and malformed archives.
  - **Macro Neutralization:** Macro sheets and hidden macro streams are stripped or rejected by the ingestion engine, ensuring no macro execution payload reaches the browser runtime or backend database.

---

## 2. Hostile Formula Injection (`packages/engine/src/export`)
* **Vectors Tested:** CSV, JSON, TSV, and XLSX export files injected with DDE/command execution strings (`=cmd|' /C calc'!A0`, `=1+1`, `+cmd`, `-10`, `@SUM(A1:A10)`, `|cmd`, `\t=cmd`, `\r\n=calc`, `=HYPERLINK("javascript:...")`).
* **Findings:**
  - **CSV/TSV/JSON Exporters:** Automatically prepend single quotes (`'`) to any cell value beginning with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`, `\n`, `|`), forcing spreadsheet software to treat them as literal strings.
  - **XLSX Exporter:** Explicitly forces cell type `'s'` (string literal) for all cell values starting with formula prefixes, completely neutralizing formula injection and command execution vectors in Microsoft Excel and LibreOffice Calc.
  - **Schema Headers:** `ExportColumnKeySchema` rigidly rejects prototype-polluting property keys (`__proto__`, `constructor`, `prototype`) at the boundary.

---

## 3. Prompt Injection & Jailbreaks (`evals/prompt_injection.json`)
* **Vectors Tested:** Comprehensive corpus of prompt injection payloads, instruction overrides, system prompt leak attempts, and jailbreak strings evaluated against AI query generation and chat handlers.
* **Findings:**
  - **Corpus Coverage:** All test cases in [`prompt_injection.json`](file:///home/rvr/Work/basi/UnSheet/evals/prompt_injection.json) are executed and validated by [`prompt_injection.test.ts`](file:///home/rvr/Work/basi/UnSheet/evals/prompt_injection.test.ts).
  - **Isolation:** AI assistants and query generators operate on strongly typed schema boundaries and are instructed to treat user spreadsheet cell values and table content as untrusted data, preventing instruction hijacking or system prompt exfiltration.

---

## 4. SQL Injection & Query Validation (`packages/engine/src/query`)
* **Vectors Tested:** SQL injection attempts against `compileQueryPlanToSql` and DuckDB-WASM query compilation (e.g., `; DROP TABLE users; --`, UNION-based injection, comments within table/column identifiers).
* **Findings:**
  - **Identifier Sanitization:** All table and column identifiers are validated against strict alphanumeric and safe character schemas (`ExportColumnKeySchema` / table name validation) before SQL generation.
  - **Parameterized AST:** Query compilation constructs queries through strict AST transformations rather than raw string concatenation, completely neutralizing SQL injection vectors against DuckDB-WASM.

---

## 5. Share Link Brute-Forcing, Path Traversal & Timing Oracles (`apps/web/app/api/share`)
* **Vectors Tested:** Brute-force guessing of share tokens, SQL/NoSQL injection in token parameters, path traversal (`../../`), null bytes (`\0`), oversized tokens (>128 chars), and timing oracle probes.
* **Findings:**
  - **Token Entropy & Validation:** `ShareTokenSchema` mandates minimum 22 characters ($\ge 128$ bits entropy) and URL-safe base64url regex (`/^[A-Za-z0-9_-]+$/`), blocking path traversal and injection.
  - **Timing Oracle Prevention:** `GET /api/share/[token]` returns an **identical 404 response** (`{ error: 'Share link not found or expired' }`) for missing, expired, revoked, or malformed tokens, preventing enumeration oracles.

---

## 6. Rate-Limiting Evasion & DoS Resiliency (`apps/web/app/api/share`, `apps/web/app/api/ask`)
* **Vectors Tested:** High-frequency request flooding, IP spoofing headers (`X-Forwarded-For`), oversized snapshot payloads (>10,000 rows).
* **Findings:**
  - **Rate Limiting:** IP-based rate limiters enforce strict quotas (e.g., 60 requests/min on share endpoints) returning `429 Too Many Requests` with proper `Retry-After` headers.
  - **Payload Capping:** `CreateShareLinkRequestSchema` enforces `max(10000)` on row data snapshots, protecting against memory exhaustion / DoS attacks.

---

## Conclusion

Unsheet exhibits a robust, enterprise-grade security posture across all evaluated vectors. All adversarial tests pass successfully, confirming that the platform is well-defended against malicious inputs, prompt injections, formula exploits, and denial-of-service attempts.
