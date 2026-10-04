# Phase 3 DevOps Security Remediation Handoff Note

**Agent:** `devops-engineer`  
**Branch:** `agent/devops/phase3-fixes`  
**Owned Paths:**
- `apps/web/next.config.mjs`
- `apps/web/test/config.test.ts`
- `docs/handoffs/phase3-devops-fixes.md`

**Target Security Findings:**
- `SEC-P3-01`: Permissive CSP with `'unsafe-inline'` and missing `frame-ancestors 'none'`
- `SEC-P3-06`: External jsDelivr CDN bundle network connect blocked by CSP
- `SEC-P3-12`: Missing `Strict-Transport-Security` (HSTS) header

**Status:** Completed & Verified

---

## 1. Executive Summary

In accordance with Phase 3 security audit findings and the Unsheet Threat Model (`docs/THREAT_MODEL.md` Mitigation 7), `apps/web/next.config.mjs` has been updated to harden the Content Security Policy (CSP) and HTTP response headers.

Key updates:
1. **SEC-P3-01 (CSP Hardening)**:
   - Stripped `'unsafe-inline'` from `script-src`.
   - Added `'wasm-unsafe-eval'` and `'unsafe-eval'` to `script-src` to permit WebAssembly execution required by DuckDB-WASM without exposing inline script execution vectors.
   - Added `frame-ancestors 'none';` to enforce clickjacking and UI redressing protection at the CSP level across modern user agents.
   - Added `worker-src 'self' blob:;` and `child-src 'self' blob:;` to govern DuckDB-WASM background web worker spawning.
2. **SEC-P3-06 (CDN Fetch Allowlist)**:
   - Updated `connect-src` in CSP to include `https://cdn.jsdelivr.net` alongside `'self'`, `blob:`, and `data:`, permitting DuckDB-WASM bundle downloads while preventing arbitrary third-party outbound connections.
3. **SEC-P3-12 (HSTS Header)**:
   - Configured `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` in `securityHeaders`.
4. **Test Suite Coverage**:
   - Expanded unit tests in `apps/web/test/config.test.ts` to assert that `Strict-Transport-Security` is configured, `frame-ancestors 'none'` is present, `script-src` does not contain `'unsafe-inline'`, and workers / jsdelivr are allowlisted.

---

## 2. Configuration Changes

### 2.1. `apps/web/next.config.mjs`
```javascript
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob: data: https://cdn.jsdelivr.net; worker-src 'self' blob:; child-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';",
  },
];
```

### 2.2. `apps/web/test/config.test.ts`
Asserts that:
- `Strict-Transport-Security` equals `'max-age=63072000; includeSubDomains; preload'`
- CSP includes `frame-ancestors 'none'`
- CSP includes `worker-src 'self' blob:` and `child-src 'self' blob:`
- CSP includes `https://cdn.jsdelivr.net`
- CSP `script-src` directive does not contain `'unsafe-inline'`
- CSP `script-src` directive contains `'wasm-unsafe-eval'`

---

## 3. Verification & Test Execution

### 3.1. Unit & Config Tests
```bash
$ pnpm --filter @unsheet/web test test/config.test.ts

 ✓ test/config.test.ts (3 tests) 3ms
   ✓ Next.js Security & Build Configuration > defines required security headers
   ✓ Next.js Security & Build Configuration > configures transpilePackages for monorepo workspace packages
   ✓ Next.js Security & Build Configuration > configures webpack WebAssembly and extension alias

Test Files  1 passed (1)
     Tests  3 passed (3)
```

Full web test suite:
```bash
$ pnpm --filter @unsheet/web test

Test Files  7 passed (7)
     Tests  39 passed (39)
```

### 3.2. Type Checking
```bash
$ pnpm --filter @unsheet/web typecheck

$ tsc --noEmit
# Exit code 0
```

### 3.3. Production Build
```bash
$ pnpm --filter @unsheet/web build

$ NEXT_TELEMETRY_DISABLED=1 next build
   ▲ Next.js 15.5.27
   Creating an optimized production build ...
   Linting and checking validity of types     ✓ 
   Collecting page data     ✓ 
   ✓ Generating static pages (4/4)
   Collecting build traces     ✓ 
   Finalizing page optimization     ✓ 
# Exit code 0
```

---

## 4. Summary of Touched Files

- `apps/web/next.config.mjs` (remediated CSP and added HSTS)
- `apps/web/test/config.test.ts` (added security header & CSP assertions)
- `docs/handoffs/phase3-devops-fixes.md` (handoff documentation)
