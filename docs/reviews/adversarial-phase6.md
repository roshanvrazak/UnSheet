# Adversarial Red-Team Report: Phase 6 Share & Export

**Target Scope:**
- `packages/engine/src/export/**`
- `apps/web/app/api/share/**`
- `apps/web/components/share/**`
- `apps/web/components/export/**`
- `apps/web/app/share/[token]/page.tsx`

**Review Date:** October 4, 2026  
**Auditor:** Adversarial QA & Red-Team Agent

---

## Executive Summary

Phase 6 introduces robust export capabilities (`csv`, `xlsx`, `json`, `tsv`) with automatic formula neutralization, as well as an encrypted/ephemeral dashboard sharing system with rate-limited token lookups, revocation workflows, and optional data snapshots.

Our adversarial testing subjected these components to rigorous malformed payloads, formula injection strings, timing oracle probes, prototype pollution vectors, and oversized snapshot arrays. Overall, UnSheet's defenses demonstrated **exceptional resilience**, with strict schema enforcement at the contracts layer (`@unsheet/contracts`) and rigorous neutralization across exporters.

---

## Detailed Findings & Attack Vector Analysis

### 1. Formula Injection & Hostile Export Cells (`packages/engine/src/export/**`)
* **Vectors Tested:** `=cmd|' /C calc'!A0`, `=1+1`, `+cmd`, `-10`, `@SUM(A1:A10)`, `|cmd`, `\t=cmd`, `\r\n=calc`, `=HYPERLINK("javascript:...")`, and prototype-polluting column headers.
* **Findings:**
  - **CSV & JSON Exporters:** Successfully neutralize cells starting with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`, `\n`, `|`) by prepending a single quote (`'`), forcing literal interpretation in Excel and LibreOffice Calc.
  - **XLSX Exporter:** Uses SheetJS (`xlsx`) and explicitly enforces cell type `'s'` (string literal) for any cell starting with formula triggers, neutralizing DDE and command execution vectors.
  - **Headers:** `ExportColumnKeySchema` successfully rejects prototype-polluting property names (`__proto__`, `constructor`, `prototype`) at the Zod boundary.

### 2. Share Link Attacks & Token Enumeration (`apps/web/app/api/share/**`)
* **Vectors Tested:** Brute-force token guessing, SQL injection (`' OR '1'='1`), path traversal (`../../`), null bytes (`\0`), oversized tokens (>128 chars), and rate limit bypasses.
* **Findings:**
  - **Token Generation & Validation:** `ShareTokenSchema` mandates minimum 22 characters (providing $\ge 128$ bits entropy) and strictly enforces URL-safe base64url/alphanumeric regex (`/^[A-Za-z0-9_-]+$/`), completely neutralizing path traversal, SQL injection, and null byte injection.
  - **Oracle Prevention:** `GET /api/share/[token]` returns an **identical 404 response** (`{ error: 'Share link not found or expired' }`) whether a token is missing, expired, revoked, or structurally malformed. This eliminates timing and error-based enumeration oracles.
  - **Rate Limiting:** IP-based rate limiter enforces 60 requests per minute per IP on `/api/share/[token]`, returning `429 Too Many Requests` with a `Retry-After` header upon exhaustion.

### 3. Snapshot Data Tampering & XSS (`apps/web/app/share/[token]/page.tsx`)
* **Vectors Tested:** Oversized snapshot arrays (>10,000 rows) and injected `<script>` tags inside snapshot cell values.
* **Findings:**
  - **Row Capping:** `CreateShareLinkRequestSchema` strictly enforces `max(10000)` on `dataSnapshot`, preventing memory exhaustion / denial of service attacks via giant payloads.
  - **XSS Mitigation:** React's default text node rendering ensures any script tags or HTML embedded within snapshot values are safely escaped as plain text strings rather than executed.

---

## Automated Test Coverage

Automated adversarial test suites have been implemented and verified:
1. `packages/engine/test/adversarial/export_adversarial.test.ts`
2. `apps/web/test/api/share_adversarial.test.ts`
3. `apps/web/test/api/share.test.ts`
4. `apps/web/test/share_ui.test.tsx`

All tests pass successfully in the test runner.
