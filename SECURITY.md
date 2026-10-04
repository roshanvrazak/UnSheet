# Unsheet Security Policy & Threat Model

Unsheet is committed to the highest standards of data privacy and application security. Because Unsheet processes arbitrary user-supplied spreadsheets and interacts with AI models, security is engineered into the core architecture from the metal up.

---

## 1. Security Policy & Vulnerability Reporting

If you discover a security vulnerability within Unsheet, we appreciate your help in disclosing it responsibly.

- **Reporting Email**: `security@unsheet.dev` (or open a confidential security advisory on GitHub).
- **Response Timeline**:
  - Initial acknowledgment: Within 24 hours.
  - Triage & status update: Within 72 hours.
  - Patch release & disclosure: Coordinated disclosure within 30–90 days depending on complexity.
- **Safe Harbor**: Good-faith security research conducted in accordance with this policy will not be subject to legal action by Unsheet.

---

## 2. Threat Model & Mitigation Matrix

Unsheet follows a strict STRIDE threat model (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege). Every identified vector is neutralized by one of our **14 Mandatory Security Mitigations**.

| Threat ID | STRIDE Category | Threat Description & Attack Vector | Impact | Target Component | Mitigations Applied | Status |
|---|---|---|---|---|---|---|
| **THREAT-01** | Denial of Service | Malicious `.xlsx` file designed as a zip bomb to crash browser tab | High (Tab crash / OOM) | Ingest Parser (`@unsheet/engine`) | **Mitigation 1**: 10MB file cap, 200MB uncompressed cap, 100:1 ratio cap, row/col bounds | ENFORCED |
| **THREAT-02** | Denial of Service / XXE | Billion laughs entity expansion attack embedded in sheet XML | High (CPU/Memory exhaustion) | Ingest Parser (`@unsheet/engine`) | **Mitigation 2**: External DTD & entity expansion disabled | ENFORCED |
| **THREAT-03** | Tampering / RCE | Malicious spreadsheet formulas attempting execution or external linking | High (Arbitrary action) | Normalizer (`@unsheet/engine`) | **Mitigation 3**: Zero runtime formula execution; cached values only | ENFORCED |
| **THREAT-04** | Elevation of Privilege | Prototype pollution via `__proto__`, `constructor`, `prototype` in headers | High (RCE / State corruption) | Normalizer & Contracts | **Mitigation 4**: SafeIdentifier sanitization & prototype key rejection | ENFORCED |
| **THREAT-05** | Tampering / RCE | Formula injection in CSV/XLSX export opened by victim in Excel | High (Client RCE via DDE) | Export Service (`apps/web`) | **Mitigation 5**: Single quote prepending on `=, +, -, @, \t, \r` | ENFORCED |
| **THREAT-06** | Tampering / XSS | Stored or reflected XSS in cell data, column headers, or LLM output | High (Session theft / DOM access) | Total Renderer (`apps/web`) | **Mitigation 6**: Zero `dangerouslySetInnerHTML`, strict React text escaping | ENFORCED |
| **THREAT-07** | Information Disclosure | Unauthorized data exfiltration or framing via clickjacking | Medium (Data leak / UI redressing) | HTTP Response Headers | **Mitigation 7**: Strict CSP (`frame-ancestors 'none'`, restrictive `connect-src`) | ENFORCED |
| **THREAT-08** | Information Disclosure / DoS | Raw row data exfiltrated to LLM or prompt hijacking via sheet text | Critical (Privacy breach) | LLM Gateway (`apps/web/api`) | **Mitigation 8**: Zero raw row egress, capped samples (<=5 items, <=40 chars), Zod output parsing | ENFORCED |
| **THREAT-09** | Elevation of Privilege | SQL injection or banned function calls via DuckDB queries | High (Data tampering / Sandbox escape) | Query Engine (`@unsheet/engine`) | **Mitigation 9**: DuckDB-WASM sandbox, single SELECT AST validation, banned DDL/DML/funcs | ENFORCED |
| **THREAT-10** | Information Disclosure | Server breach exposing customer spreadsheets | Critical (Data leak) | Backend Architecture | **Mitigation 10**: Client-side data isolation, zero server persistence in anonymous mode | ENFORCED |
| **THREAT-11** | Information Disclosure / Spoofing | Brute-force enumeration of shared dashboard URLs | High (Unauthorized access) | Share Link Service (`apps/web/api`) | **Mitigation 11**: >=128-bit unguessable tokens, rate limiting, expiry timestamps | ENFORCED |
| **THREAT-12** | Elevation of Privilege / IDOR | Unauthorized database modification of other users' dashboards | High (Data corruption / takeover) | Database (`supabase`) | **Mitigation 12**: Deny-by-default Supabase RLS policies | ENFORCED |
| **THREAT-13** | Denial of Service | Automated bot flooding AI endpoints causing runaway billing | High (Financial drain / DoS) | LLM API Routes (`apps/web/api`) | **Mitigation 13**: Rate limiting, prompt token caps, `DISABLE_LLM=true` kill-switch | ENFORCED |
| **THREAT-14** | Tampering / Supply Chain | Malicious dependency or leaked secrets in repository | Critical (Supply chain compromise) | Monorepo Platform & CI | **Mitigation 14**: Pinned SheetJS vendor tarball, secret scanning, pnpm audit high gate | ENFORCED |

---

## 3. Detailed Breakdown of the 14 Security Mitigations

### Mitigation 1: Ingestion File Size, Memory Caps & Zip-Bomb Defense
- **Max File Size**: 10 MB raw upload buffer limit.
- **Uncompressed Cap**: Maximum 200 MB uncompressed buffer limit during ZIP decompression.
- **Ratio Check**: Abort if `uncompressed_bytes / compressed_bytes > 100`.
- **Dimensions Cap**: Maximum 20 sheets, 200,000 rows, and 200 columns per sheet.

### Mitigation 2: XML Entity Expansion Neutralization
- External DTDs, system identifiers, and entity expansions are strictly disabled (`doctype: false`, `nodeProcess: false`) in SheetJS to prevent Billion Laughs and XXE attacks.

### Mitigation 3: Formula Execution Sandbox
- Formulas are **never evaluated** at runtime. The engine reads only pre-computed cached values (`cell.v`). Formula strings (`cell.f`) are treated as opaque strings. External workbook links are disabled.

### Mitigation 4: Prototype Pollution Defense
- Column names are sanitized into strict `SafeIdentifier` tokens (`/^[a-zA-Z_][a-zA-Z0-9_]*$/`). `__proto__`, `constructor`, and `prototype` keys are rejected across contracts and normalizers.

### Mitigation 5: Formula Injection Neutralization in Exports
- Exported CSV and XLSX fields starting with `=`, `+`, `-`, `@`, `\t`, or `\r` have a leading single quote (`'`) prepended to neutralize DDE / formula execution vulnerabilities.

### Mitigation 6: XSS Neutralization & Zero `dangerouslySetInnerHTML`
- Zero use of `dangerouslySetInnerHTML` across the codebase, enforced via AST-level ESLint rules (`eslint-plugin-security`). All content is rendered via React text node escaping.

### Mitigation 7: Strict Content Security Policy (CSP) & Security Headers
- Strict CSP headers (`default-src 'self'`, `script-src 'self' 'nonce-...'; object-src 'none'`, `frame-ancestors 'none'`, `connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.openai.com`) alongside `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Strict-Transport-Security`.

### Mitigation 8: Prompt Injection & Data Privacy in LLM Calls
- **Zero Raw Data Egress**: Raw row data is never sent to LLMs. Only column profiles are transmitted, with sample values strictly capped at **5 items maximum**, each truncated to **40 characters maximum**, and formula triggers stripped. All LLM output is validated against Zod schemas.

### Mitigation 9: DuckDB-WASM Sandbox & SQL Safety
- DuckDB runs inside an isolated WebAssembly sandbox. User/LLM SQL queries are parsed through an AST validator enforcing single-statement `SELECT` queries and strictly banning DDL/DML (`DROP`, `INSERT`, `UPDATE`, `ALTER`, `ATTACH`, `PRAGMA`).

### Mitigation 10: Client-Side Data Isolation
- Anonymous and demo workbooks reside 100% in volatile client memory and IndexedDB. Zero customer spreadsheet rows are stored on application servers.

### Mitigation 11: Cryptographically Secure Share Links (>= 128-bit Entropy)
- Share tokens are generated using `crypto.getRandomValues()`, providing >= 128 bits of entropy (22+ URL-safe base64 characters). Lookups use timing-safe comparisons and rate limiting.

### Mitigation 12: Supabase Row-Level Security (RLS)
- All Supabase tables have RLS enabled with a deny-by-default posture. Shared dashboards require valid unguessable tokens where `expires_at > NOW()`.

### Mitigation 13: API Rate Limiting & Spend Protection
- IP-based rate limiting on LLM API routes, maximum prompt token caps, and an instantaneous `DISABLE_LLM=true` kill-switch.

### Mitigation 14: Supply Chain Integrity & Secrets Management
- Pinned vendor tarball for SheetJS (`xlsx-0.20.3.tgz`), dual-engine secret scanning (`scripts/scan-secrets.sh`), and `pnpm audit` gating.

---

## 4. Responsible Disclosure & Bug Bounty

We welcome security disclosures from the community. Valid reports detailing novel vulnerabilities impacting user privacy or sandbox integrity are eligible for public acknowledgment and recognition in our security hall of fame. Please report findings to `security@unsheet.dev`.
