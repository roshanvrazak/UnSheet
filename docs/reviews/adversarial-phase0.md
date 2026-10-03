# Adversarial Red-Team Security Review: Phase 0 Contracts

**Date**: 2026-10-04  
**Target**: `@unsheet/contracts` (`packages/contracts/src/**`, `packages/contracts/test/**`)  
**Reviewer**: Adversarial QA & Red-Team Agent  
**Status**: Completed  
**Test Suite**: [`packages/contracts/test/adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/test/adversarial.test.ts) (29 tests passing)

---

## 1. Executive Summary

During Phase 0, we executed systematic adversarial red-teaming against `@unsheet/contracts`. The objective was to probe data contracts, schema boundaries, sanitization invariants, and type definitions for bypasses, injection vectors, memory exhaustion paths, and logic flaws prior to Phase 1 ingestion engine development.

The contracts demonstrate rigorous foundational design:
- `SafeIdentifierSchema` actively rejects canonical prototype pollution keys (`__proto__`, `constructor`, `prototype`) and non-alphanumeric identifiers.
- `SampleValueSchema` limits length to 40 characters and caps sample arrays at 5 items, mitigating bulk LLM data exfiltration.
- `WidgetSpecSchema` enforces a strict 6-variant discriminated union on `type` (`kpi`, `line`, `bar`, `donut`, `table`, `pivot`).
- `ShareTokenSchema` mandates URL-safe characters and a minimum length of 22 characters.

However, hostile fuzzing and red-team payloads exposed **8 security vulnerabilities and validation gaps** spanning XSS/URI scheme injection, formula injection bypasses, prototype pollution in non-identifier fields, layout overflow, and unbounded DoS vectors.

---

## 2. Vulnerability & Findings Matrix

| ID | Category | Severity | Description | Status in Contracts |
|---|---|---|---|---|
| **ADV-P0-01** | Input Validation / XSS | **HIGH** | `CreateShareLinkResponse.shareUrl` accepts `javascript:`, `data:`, and `file:` schemes via `z.string().url()` | Vulnerable (Exposed via automated test) |
| **ADV-P0-02** | Formula Injection | **MEDIUM** | `SampleValueSchema` bypassed by leading spaces (`" =cmd"`), newlines (`"\n=1+1"`), and DDE pipe (`"\|cmd"`) | Vulnerable (Exposed via automated test) |
| **ADV-P0-03** | Injection / Exfiltration | **MEDIUM** | `ColumnProfile.topValues` (`CategoryFrequency.value`) allows raw unescaped formula strings and prompt injection strings | Vulnerable (Exposed via automated test) |
| **ADV-P0-04** | Prototype Pollution | **MEDIUM** | Entity ID fields (`DashboardSpec.id`, `sheetBinding`, `Template.id`, `SheetProfile.sheetId`) accept `__proto__` and `constructor` | Vulnerable (Exposed via automated test) |
| **ADV-P0-05** | Logic / Layout Safety | **MEDIUM** | `WidgetGridPositionSchema` permits horizontal grid overflow (`x + w > 12`, e.g. `x=11, w=12 -> 23`) | Vulnerable (Exposed via automated test) |
| **ADV-P0-06** | Denial of Service (DoS) | **LOW** | Unbounded collection sizes in `DashboardSpec.widgets`, `QueryResult.rows`, and unbounded `WorkbookModel.fileSize` | Gap Identified (Exposed via automated test) |
| **ADV-P0-07** | Cryptographic Hygiene | **LOW** | `ShareTokenSchema` accepts low-entropy repetitive tokens (`"A".repeat(22)`) and 22-char hex (<128-bit entropy) | Gap Identified (Exposed via automated test) |
| **ADV-P0-08** | Data Integrity | **LOW** | `NumericStatsSchema` and `QueryResult.executionTimeMs` accept `Infinity` and `-Infinity` (lack `.finite()`) | Gap Identified (Exposed via automated test) |

---

## 3. Deep-Dive Vulnerability Analyses

### ADV-P0-01: Malicious URI Scheme Injection in `CreateShareLinkResponse.shareUrl`
- **Severity**: HIGH (CWE-79, CWE-918)
- **Affected Schema**: `CreateShareLinkResponseSchema` in [`packages/contracts/src/api.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/api.ts#L63-L69)
- **Mechanism**:
  `shareUrl` is defined as `z.string().url()`. Under the WHATWG URL standard and Zod's internal URL parser, URLs with schemes such as `javascript:`, `data:`, and `file:` are valid URLs.
- **Proof of Concept Payload**:
  ```ts
  CreateShareLinkResponseSchema.parse({
    shareToken: 'k9Z_3Xv8Lm2Qp7Rt1Wy4Bn',
    shareUrl: 'javascript:alert(document.domain)',
  });
  ```
- **Impact**: If a client application renders this URL in an `<a href={shareUrl}>` tag or shares it with end users, clicking the link executes arbitrary JavaScript in the victim's browser session.
- **Remediation**:
  Enforce strict HTTPS scheme validation:
  ```ts
  shareUrl: z.string().url().refine(
    (url) => url.startsWith('https://') || url.startsWith('http://localhost'),
    { message: 'Share URL must use https:// protocol' }
  )
  ```

---

### ADV-P0-02: Formula Injection Bypass in `SampleValueSchema`
- **Severity**: MEDIUM (CWE-1236: Improper Neutralization of Formula Elements in CSV File)
- **Affected Schema**: `SampleValueSchema` in [`packages/contracts/src/common.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/common.ts#L26-L32)
- **Mechanism**:
  The regex `/^[=+\-@\t\r]/` only evaluates the string's first character against `=, +, -, @, \t, \r`. It fails to account for leading whitespace, newline characters (`\n` / `0x0A`), or DDE pipe execution triggers (`|`).
- **Proof of Concept Payloads**:
  - ` =cmd|' /C calc'!A0` (leading space before `=`)
  - `\n=1+1` (leading newline character before `=`)
  - `|cmd|' /C calc'!A0` (DDE pipe trigger syntax)
  - `\uFF1D1+1` (Unicode full-width equal sign)
- **Impact**: When sample values or exported datasets containing these values are opened in Microsoft Excel or LibreOffice, spreadsheet software strips leading whitespace or parses the command syntax, triggering external process execution.
- **Remediation**:
  Trim leading whitespace before checking and expand trigger characters:
  ```ts
  export const SampleValueSchema = z
    .string()
    .max(40, 'Sample value exceeds maximum length of 40 characters')
    .refine(
      (val) => !/^[=+\-@\t\r\n|]/.test(val.trimStart()),
      { message: 'Sample value must not start with formula trigger characters' }
    );
  ```

---

### ADV-P0-03: Formula Injection & Prompt Hijacking in `ColumnProfile.topValues`
- **Severity**: MEDIUM (CWE-1236, CWE-74)
- **Affected Schema**: `CategoryFrequencySchema` in [`packages/contracts/src/profile.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/profile.ts#L50-L56)
- **Mechanism**:
  `ColumnProfileSchema.sampleValues` is sanitized and capped to 5 items of <=40 characters. However, `ColumnProfileSchema.topValues` allows up to 50 items where each `value` is an unconstrained string of up to 256 characters (`z.string().max(256)`).
- **Proof of Concept Payload**:
  ```ts
  CategoryFrequencySchema.parse({
    value: "=cmd|' /C calc'!A0",
    count: 10,
    percentage: 100,
  });
  ```
- **Impact**: When `ColumnProfile` is rendered in tabular UI, exported to CSV, or fed to LLM prompts during refinement/Ask-Your-Data, attacker-controlled strings in `topValues` can execute formula injection or prompt injection payloads.
- **Remediation**: Apply formula trigger neutralization and string sanitization to `CategoryFrequencySchema.value`.

---

### ADV-P0-04: Prototype Pollution Key Acceptance in Unconstrained Entity IDs
- **Severity**: MEDIUM (CWE-1321)
- **Affected Schemas**:
  - `DashboardSpec.id` ([`packages/contracts/src/spec.ts#L299`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/spec.ts#L299))
  - `DashboardSpec.sheetBinding` ([`packages/contracts/src/spec.ts#L302`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/spec.ts#L302))
  - `Template.id` ([`packages/contracts/src/template.ts#L49`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/template.ts#L49))
  - `SheetProfile.sheetId` ([`packages/contracts/src/profile.ts#L85`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/profile.ts#L85))
- **Mechanism**:
  While column keys and table names use `SafeIdentifierSchema`, entity IDs are typed as generic `z.string().min(1).max(64)`. They permit `__proto__`, `constructor`, and `prototype`.
- **Proof of Concept Payload**:
  ```ts
  DashboardSpecSchema.parse({
    ...validSpec,
    id: '__proto__',
    sheetBinding: '__proto__',
  });
  ```
- **Impact**: If downstream cache stores, spec registries, or state stores index dashboard specs by ID via plain JavaScript objects (`specs[spec.id] = spec;`), prototype pollution occurs, allowing prototype override or RCE.
- **Remediation**: Refactor entity IDs to use `SafeIdentifierSchema` or an explicit alphanumeric slug schema that forbids prototype property names.

---

### ADV-P0-05: Horizontal Grid Overflow in `WidgetGridPositionSchema`
- **Severity**: MEDIUM (CWE-20)
- **Affected Schema**: `WidgetGridPositionSchema` in [`packages/contracts/src/spec.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/spec.ts#L7-L12)
- **Mechanism**:
  `x` is constrained to `0..11` and `w` is constrained to `1..12`. However, their sum `x + w` is not validated. In a 12-column grid system, any widget where `x + w > 12` (such as `x: 11, w: 12`) breaks CSS grid layouts, causes overlapping widgets, or triggers client-side layout rendering panics.
- **Proof of Concept Payload**:
  ```ts
  WidgetGridPositionSchema.parse({ x: 11, y: 0, w: 12, h: 4 }); // x + w = 23 columns
  ```
- **Impact**: Broken dashboard layout rendering, UI crashes in grid rendering engines (`react-grid-layout`), and visual denial of service.
- **Remediation**:
  Add cross-field refinement:
  ```ts
  export const WidgetGridPositionSchema = z.object({
    x: z.number().int().min(0).max(11),
    y: z.number().int().nonnegative(),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(1).max(24),
  }).refine((grid) => grid.x + grid.w <= 12, {
    message: 'Widget grid position exceeds 12-column boundary (x + w must be <= 12)',
  });
  ```

---

### ADV-P0-06: Unbounded Collections and File Size (DoS)
- **Severity**: LOW (CWE-400)
- **Affected Schemas**:
  - `DashboardSpec.widgets`: `z.array(WidgetSpecSchema).min(1)` (no max limit)
  - `DashboardSpec.filters`: `z.array(FilterSpecSchema)` (no max limit)
  - `QueryResult.rows`: `z.array(z.record(SafeIdentifierSchema, z.unknown()))` (no max limit)
  - `WorkbookModel.fileSize`: `z.number().int().positive()` (no max limit)
- **Mechanism**:
  Several collection arrays have lower bounds (`min(1)`) but omit upper bounds (`max(N)`).
- **Proof of Concept Payload**:
  ```ts
  const spec = { ...validSpec, widgets: Array(500).fill(validWidget) };
  DashboardSpecSchema.parse(spec); // Passes 500 widgets
  ```
- **Impact**: Attackers can submit specs with thousands of widgets, forcing the browser to allocate gigabytes of memory and crash user tabs.
- **Remediation**: Add `.max(50)` to `DashboardSpec.widgets`, `.max(20)` to `DashboardSpec.filters`, and `.max(50 * 1024 * 1024)` (50MB) to `fileSize`.

---

### ADV-P0-07: Low-Entropy Repetitive Share Tokens
- **Severity**: LOW (CWE-330)
- **Affected Schema**: `ShareTokenSchema` in [`packages/contracts/src/api.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/api.ts#L44-L48)
- **Mechanism**:
  `ShareTokenSchema` checks length (`min: 22`) and character set (`/^[A-Za-z0-9_-]+$/`). However, strings composed of 22 identical characters (e.g. `'A'.repeat(22)`) or sequential hex characters pass validation despite having zero to low information entropy.
- **Impact**: While token generation is primarily server-side, accepting low-entropy tokens permits predictable or forgeable share tokens in mock/test or decentralized scenarios.
- **Remediation**: Enforce minimum character set diversity (e.g. requiring a combination of lowercase, uppercase, and numbers/symbols).

---

### ADV-P0-08: Non-Finite Numbers in Statistics and Metrics
- **Severity**: LOW (CWE-20)
- **Affected Schemas**:
  - `NumericStatsSchema` in [`packages/contracts/src/profile.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/profile.ts#L35-L43)
  - `QueryResult.executionTimeMs` in [`packages/contracts/src/query.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/query.ts#L94)
- **Mechanism**:
  In Zod, `z.number()` accepts `Infinity` and `-Infinity` by default unless `.finite()` is appended.
- **Proof of Concept Payload**:
  ```ts
  NumericStatsSchema.parse({ min: -Infinity, max: Infinity, sum: Infinity });
  ```
- **Impact**: When serialized to JSON, `Infinity` becomes `null`, silently corrupting statistical profiles, or triggering floating-point errors in downstream WebAssembly computations.
- **Remediation**: Append `.finite()` to all `z.number()` declarations in statistical schemas.

---

## 4. Test Suite Execution & Verification

All 29 adversarial tests and 25 unit tests execute and pass cleanly:

```bash
$ pnpm --filter @unsheet/contracts test

 ✓ src/index.test.ts (1 test)
 ✓ test/contracts.test.ts (24 tests)
 ✓ test/adversarial.test.ts (29 tests)

 Test Files  3 passed (3)
      Tests  54 passed (54)
```

The automated test file [`packages/contracts/test/adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/test/adversarial.test.ts) establishes regression protections across:
1. `Prototype Pollution Vectors` (SafeIdentifier, SheetModel rows, Share snapshots, Entity IDs)
2. `Formula Injection Attacks` (Canonical triggers, whitespace bypass, newline bypass, pipe bypass, CategoryFrequency bypass)
3. `Oversized Payloads & Limit Enforcement` (Sample arrays, string limits, spec refinement, unbounded widget DoS, unbounded fileSize)
4. `Discriminated Union & Layout Validation` (Unknown widget types, negative grid coordinates, grid overflow, negative padding/gap, domain constraints)
5. `Share Token Entropy & URL Safety` (Entropy length, illegal characters, low entropy tokens, XSS protocol injection)
6. `Query Plan & Filter Security` (SQL injection in identifiers, operator whitelist enforcement, limit/offset bounds)
7. `Floating Point & Numeric Edge Cases` (Infinity in stats, executionTimeMs)

---

## 5. Prioritized Remediation Roadmap

1. **Immediate (Phase 0 Polish / Phase 1 Ingestion Engine Pre-requisite)**:
   - Restrict `CreateShareLinkResponse.shareUrl` to `https://` (ADV-P0-01).
   - Update `SampleValueSchema` to `.trimStart()` before trigger checks and add `\n` and `|` to the trigger regex (ADV-P0-02).
   - Add `.refine(grid => grid.x + grid.w <= 12)` to `WidgetGridPositionSchema` (ADV-P0-05).
2. **Phase 1 Hardening**:
   - Sanitize `CategoryFrequencySchema.value` against formula injection (ADV-P0-03).
   - Bound entity IDs (`DashboardSpec.id`, `Template.id`) to `SafeIdentifierSchema` (ADV-P0-04).
   - Apply `.max(50)` to `DashboardSpec.widgets` and `.max(50 * 1024 * 1024)` to `WorkbookModel.fileSize` (ADV-P0-06).
   - Add `.finite()` to all `z.number()` fields in `NumericStatsSchema` (ADV-P0-08).
