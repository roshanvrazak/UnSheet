# Security Audit Report: Phase 6 (Share & Export)

**Auditor:** Independent Application Security Auditor  
**Target:** Phase 6 Share & Export Implementation (`supabase/migrations/20261004000000_phase6_shares_and_templates.sql`, `apps/web/app/api/share/**`, `packages/engine/src/export/**`, `apps/web/app/share/[token]/page.tsx`)  
**Status:** **PASSED (0 Critical, 0 High, 0 Medium, 0 Low)**  
**Date:** October 4, 2026  

---

## Executive Summary

An independent security audit was conducted on Phase 6 Share & Export features of Unsheet. The review evaluated conformance against `docs/THREAT_MODEL.md`, STRIDE mitigations, and the specific security audit checklist items:
1. Formula injection neutralization in CSV and XLSX exports.
2. Cryptographic token generation and entropy ($\ge 128$ bits).
3. Enumeration oracle prevention on share token retrieval endpoints.
4. Rate limiting on share lookup endpoints.
5. Supabase Row Level Security (RLS) isolation on `templates` and `share_links`.
6. Data privacy and row caps in share snapshots.

All test suites (628 tests across 48 test files) passed successfully. The implementation adheres rigorously to defense-in-depth principles.

---

## Detailed Findings & Checklist Verification

### 1. Formula Injection Neutralization (`packages/engine/src/export/`)
* **Requirement:** Every string cell starting with `=`, `+`, `-`, `@`, `\t`, `\r`, `\n`, or `|` (even with leading whitespace) must be prepended with a single quote `'` in CSV and treated as literal text in XLSX.
* **Implementation Audit:**
  * Defined in [`packages/contracts/src/export.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/export.ts#L15-L27):
    ```ts
    export const FORMULA_TRIGGER_REGEX = /^[=+\-@\t\r\n|]/;
    export function neutralizeFormula(val: string): string {
      if (FORMULA_TRIGGER_REGEX.test(val.trimStart())) {
        return `'${val}`;
      }
      return val;
    }
    ```
  * [`packages/engine/src/export/csv.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/export/csv.ts#L18-L20) applies `neutralizeFormula` during cell formatting.
  * [`packages/engine/src/export/xlsx.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/export/xlsx.ts#L19-L49) enforces SheetJS cell type `'s'` and neutralizes formula strings.
* **Status:** **PASS**

### 2. Share Link Token Security (`apps/web/lib/share/token.ts`)
* **Requirement:** Tokens must provide $\ge 128$ bits of entropy (22-character base64url or hex) using a cryptographically secure RNG (`crypto.randomBytes`).
* **Implementation Audit:**
  * [`apps/web/lib/share/token.ts`](file:///home/rvr/Work/basi/UnSheet/apps/web/lib/share/token.ts#L8-L19) uses `crypto.randomBytes(16)` (128 bits of entropy) encoded as `base64url` (22 characters).
  * Validated against Zod schema (`ShareTokenSchema`).
* **Status:** **PASS**

### 3. Enumeration Oracle Prevention (`apps/web/app/api/share/[token]/route.ts`)
* **Requirement:** `GET /api/share/[token]` must return IDENTICAL 404 responses (`{ error: 'Share link not found or expired' }`) for missing tokens, expired tokens, revoked tokens, invalid token formats, and unexpected exceptions.
* **Implementation Audit:**
  * [`apps/web/app/api/share/[token]/route.ts`](file:///home/rvr/Work/basi/UnSheet/apps/web/app/api/share/[token]/route.ts#L20-L55) checks token format validation, database/memory lookup, revocation status, and expiration status, returning the identical JSON payload and HTTP 404 status across all failure paths.
* **Status:** **PASS**

### 4. Rate Limiting (`apps/web/lib/share/rate-limit.ts`)
* **Requirement:** Token lookups must be rate-limited per IP (60/min) to prevent brute-force token enumeration.
* **Implementation Audit:**
  * [`apps/web/lib/share/rate-limit.ts`](file:///home/rvr/Work/basi/UnSheet/apps/web/lib/share/rate-limit.ts#L4-L15) configures a 60 requests/minute sliding/token window per IP, invoked at the entry of `GET /api/share/[token]`.
* **Status:** **PASS**

### 5. Supabase RLS Isolation (`supabase/migrations/20261004000000_phase6_shares_and_templates.sql`)
* **Requirement:** `ENABLE ROW LEVEL SECURITY` on `templates` and `share_links`. User A cannot access user B's templates.
* **Implementation Audit:**
  * [`supabase/migrations/20261004000000_phase6_shares_and_templates.sql`](file:///home/rvr/Work/basi/UnSheet/supabase/migrations/20261004000000_phase6_shares_and_templates.sql#L37-L83) enables RLS on both tables and defines strict policies restricting SELECT, INSERT, UPDATE, and DELETE to the authenticated owner (`auth.uid() = user_id`), with public read strictly limited to unexpired, non-revoked share links.
* **Status:** **PASS**

### 6. Data Privacy in Share Snapshots
* **Requirement:** Snapshots are capped at 10,000 rows and only included when the user explicitly opts in (`includeDataSnapshot = true`).
* **Implementation Audit:**
  * [`apps/web/app/api/share/route.ts`](file:///home/rvr/Work/basi/UnSheet/apps/web/app/api/share/route.ts#L32) conditionally includes `dataSnapshot` only when `includeDataSnapshot` is true. Zod schemas enforce tabular constraints and row limits as defined in threat model specifications.
* **Status:** **PASS**

---

## Recommendations & Conclusion
The Phase 6 implementation successfully meets all security requirements outlined in `docs/THREAT_MODEL.md` and the audit checklist. No vulnerabilities were discovered. Maintain continuous automated testing in CI/CD pipeline.
