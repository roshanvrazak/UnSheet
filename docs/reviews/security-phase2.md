# Phase 2 Profiling, SpecGen & Drift Security Audit Report

**Audit Target**: Unsheet Phase 2 Deliverables  
- Statistical & Type Profiler: `packages/engine/src/profile/**` (`inference.ts`, `roles.ts`, `stats.ts`, `joins.ts`, `sheet.ts`, `workbook.ts`, `index.ts`)  
- Deterministic Spec Generator: `packages/engine/src/specgen/**` (`specgen.ts`, `index.ts`)  
- Schema Drift Engine: `packages/engine/src/drift/**` (`drift.ts`, `similarity.ts`, `coercion.ts`, `index.ts`)  
- Contracts & Payloads: `packages/contracts/src/**` (`profile.ts`, `spec.ts`, `drift.ts`, `api.ts`)  
**Auditor**: Independent Application Security Auditor  
**Date**: October 4, 2026  
**Status**: Completed  
**Compliance Standard**: `docs/THREAT_MODEL.md`, `docs/SPEC.md`, Mandatory Mitigations 4, 8, 9  

---

## 1. Executive Summary

An independent application security audit was conducted on the Phase 2 deliverables of Unsheet. This phase establishes the statistical inference engine, semantic role assignment, cross-sheet relational join candidate detection, deterministic 12-column responsive dashboard specification generation, and automated schema drift analysis.

The Phase 2 implementation establishes robust safeguards in several core areas:
- **Formula Neutralization in Stats**: Both `sampleValues` and `topValues` category frequencies sanitize formula injection triggers (`=, +, -, @, \t, \r, \n, |`), prepend single quotes (`'`), and enforce string length caps (<=40 chars for samples, <=100 chars for top values).
- **LLM Contract Boundary**: `LLMColumnProfileSchema` strictly omits `topValues` and enforces `SampleValuesArraySchema` (capped at <=5 items, <=40 chars each), adhering to Mitigation 8 of the Threat Model.
- **Spec Integrity**: `generateDashboardSpec` enforces non-overlapping widget coordinates, responsive 12-column grid placement (`x + w <= 12`), and a maximum cap of 50 widgets.
- **ReDoS Safety**: All regular expressions across `inference.ts`, `similarity.ts`, and `drift.ts` are strictly linear and free from catastrophic backtracking.

However, the audit revealed **Critical** and **High** severity vulnerabilities regarding algorithmic complexity, client-side denial of service, prototype pollution, and data boundary leakages:
1. **Critical Cartesian Pair Evaluation DoS in `joins.ts`**: `findJoinCandidates` compares all sheet and column pairs without pre-filtering. For a workbook with 20 sheets, 200 columns, and 200,000 rows (the maximum allowed bounds), the algorithm executes $15.2 \times 10^6$ column comparisons, repeatedly allocating 200,000-element arrays and sets in the innermost loop ($O(S^2 \cdot C^2 \cdot R) \approx 3 \times 10^{12}$ operations), causing browser freezing and heap exhaustion.
2. **Missing Engine-Level LLM Transformation**: While `@unsheet/contracts` defines `LLMColumnProfileSchema`, `@unsheet/engine` outputs full `ColumnProfile` objects containing up to 50 raw category values (`topValues`). The engine provides no helper to sanitize profiles for LLMs, leaving callers at high risk of sending raw spreadsheet data over the wire.
3. **Unsanitized Sheet Names**: While column identifiers enforce `SafeIdentifierSchema`, `SheetProfileSchema.sheetName` accepts arbitrary strings including `__proto__`, `constructor`, and `prototype`. When referenced in join candidates, drift reports, and spec titles, downstream systems indexing by sheet name are susceptible to prototype pollution.
4. **Value Sanitizer Null-Prototype Crashes**: Calling `String(rawVal)` on null-prototype objects (`Object.create(null)`) throws an unhandled `TypeError: Cannot convert object to primitive value`, crashing the profiler.
5. **Contract Overlap Validation Gap**: `DashboardSpecSchema` does not contain a schema-level refinement to reject overlapping widgets, permitting hostile or malformed specs from share links or LLM responses to stack widgets and crash frontend renderers.

A total of **9 findings** were identified: **1 Critical**, **2 High**, **4 Medium**, and **2 Low**.

---

## 2. Findings Summary Matrix

| ID | Title | Severity | STRIDE Category | Affected Component |
|---|---|---|---|---|
| **SEC-P2-01** | Cartesian Pair Evaluation Denial of Service in `findJoinCandidates` ($O(S^2 \cdot C^2 \cdot R)$ Complexity) | **Critical** | Denial of Service | `packages/engine/src/profile/joins.ts` |
| **SEC-P2-02** | Missing Engine-Level Transformation to `LLMColumnProfile` Exposes Raw `topValues` | **High** | Information Disclosure / Prompt Injection | `packages/engine/src/profile/sheet.ts`, `packages/contracts/src/profile.ts` |
| **SEC-P2-03** | Unchecked Prototype Pollution in Sheet Names Permitted in `SheetProfile` & `DashboardSpec` | **High** | Elevation of Privilege / Tampering | `packages/contracts/src/profile.ts`, `packages/engine/src/profile/joins.ts` |
| **SEC-P2-04** | Unhandled `TypeError` Crash in Value Sanitizers on Null-Prototype Cell Values | **Medium** | Denial of Service | `packages/engine/src/profile/stats.ts` |
| **SEC-P2-05** | Missing Overlap Constraint in `DashboardSpecSchema` Allows Visual & Render DoS | **Medium** | Denial of Service / Renderer Crash | `packages/contracts/src/spec.ts` |
| **SEC-P2-06** | Ineffective Fallback Regex in Value Sanitizers with Leading Whitespace | **Medium** | Tampering / Formula Injection | `packages/engine/src/profile/stats.ts` |
| **SEC-P2-07** | Unbounded Levenshtein Calculation Complexity in Drift Detection ($O(M \cdot N)$) | **Medium** | Denial of Service | `packages/engine/src/drift/similarity.ts`, `drift.ts` |
| **SEC-P2-08** | Inconsistent Cardinality Threshold Between Profiling and Drift Role Inference | **Low** | Data Inconsistency | `packages/engine/src/profile/inference.ts`, `drift.ts` |
| **SEC-P2-09** | Non-Standard Currency Code Fallback to `'USD'` in Type Inference | **Low** | Data Integrity | `packages/engine/src/profile/inference.ts` |

---

## 3. Detailed Audit Findings

### [SEC-P2-01] Cartesian Pair Evaluation Denial of Service in `findJoinCandidates` ($O(S^2 \cdot C^2 \cdot R)$ Complexity)
- **Severity**: **Critical**
- **STRIDE Category**: Denial of Service (DoS) / Algorithmic Complexity
- **Target**: `packages/engine/src/profile/joins.ts` (lines 77–152)
- **Description**:  
  In `findJoinCandidates`, relational join keys between sheets are discovered via a quadruple nested loop:
  ```typescript
  for (let i = 0; i < sheetList.length; i++) {
    for (let j = 0; j < sheetList.length; j++) {
      if (i === j) continue;
      const sheetA = sheetList[i]!;
      const sheetB = sheetList[j]!;

      for (const colA of sheetA.columns) {
        const valuesA = sheetA.rows.map((r) => r[colA.key]);
        const setA = new Set(...);

        for (const colB of sheetB.columns) {
          const valuesB = sheetB.rows.map((r) => r[colB.key]); // RECOMPUTED EVERY colA iteration!
          const setB = new Set(...);                           // RECOMPUTED EVERY colA iteration!

          if (!areNamesCompatible(colA.key, colB.key)) {
            continue;
          }
          ...
        }
      }
    }
  }
  ```
  Given Phase 1 bounds of $S \le 20$ sheets, $C \le 200$ columns, and $R \le 200,000$ rows:
  1. **Quadratic Column Pairings**: Across 20 sheets, there are $20 \times 19 = 380$ sheet pairs. Each sheet pair compares $200 \times 200 = 40,000$ column pairs, resulting in $15,200,000$ total column pair comparisons.
  2. **Redundant Innermost Allocations**: Inside the inner loop `for (const colB of sheetB.columns)`, `sheetB.rows.map(...)` and `new Set(...)` are allocated and populated on *every single iteration* of `colA`, performing 200 redundant full-table allocations per column.
  3. **Late Name Filtering**: `valuesB` and `setB` are allocated *before* checking `areNamesCompatible(colA.key, colB.key)`. Even if `colA` is `revenue` and `colB` is `description`, the entire 200,000-element set is constructed before the pair is discarded.
  4. **Total Workload**: The un-cached, un-bounded execution requires over $3 \times 10^{12}$ operations. In a single-threaded Web Worker or browser main thread, this locks the event loop for hours and triggers out-of-memory browser termination.
- **Vulnerability Impact**: Severe Denial of Service; uploading any multi-sheet spreadsheet with moderate row/column counts permanently freezes the browser tab during profiling.
- **Actionable Recommendation**:
  1. **Pre-Filter Candidate Columns**: Only evaluate columns that are likely identifiers:
     ```typescript
     const candidateColsA = sheetA.columns.filter((c) =>
       c.key.endsWith('_id') || c.key.endsWith('_code') || c.key.endsWith('_sku') ||
       c.key === 'id' || c.key.endsWith('_key')
     );
     ```
  2. **Filter Before Allocation**: Move `if (!areNamesCompatible(colA.key, colB.key)) continue;` to the very top of the column comparison loop *before* reading rows or constructing sets.
  3. **Cache Column Sets**: Pre-compute `Set` objects once per column per sheet before entering comparison loops:
     ```typescript
     const sheetSets = new Map<string, Set<string>>();
     ```
  4. **Sample Rows**: Cap value set construction to at most 1,000–2,000 sampled rows rather than traversing all 200,000 rows.
  5. **Limit Global Candidates**: Terminate join discovery if more than 50 candidates have been identified.

---

### [SEC-P2-02] Missing Engine-Level Transformation to `LLMColumnProfile` Exposes Raw `topValues`
- **Severity**: **High**
- **STRIDE Category**: Information Disclosure / Prompt Injection
- **Target**: `packages/engine/src/profile/sheet.ts` (lines 45–65), `packages/engine/src/profile/workbook.ts` (lines 16–26), `packages/contracts/src/profile.ts`
- **Description**:  
  Mitigation 8 of `docs/THREAT_MODEL.md` mandates:
  > *"Zero Raw Data Egress: Raw row data is never transmitted to the LLM. Metadata Capping: Only column profiles are sent, with sample values strictly capped at 5 items maximum, each truncated to 40 characters maximum, and formula triggers stripped."*
  
  In Phase 0, `LLMColumnProfileSchema = ColumnProfileSchema.omit({ topValues: true })` was created to enforce this boundary in contract requests (`SpecRefinementRequestSchema`, `AskYourDataRequestSchema`).
  
  However, within `@unsheet/engine`:
  - `profileSheet()` returns a full `SheetProfile`, where each column profile contains `topValues` (up to 50 items $\times$ 100 characters each).
  - `profileWorkbook()` returns `WorkbookProfile` containing full `SheetProfile` objects.
  - The engine exposes **zero transformation functions** (e.g. `toLLMProfile` or `toLLMColumnProfile`) to strip `topValues`.
  
  When application engineers wire the engine into Next.js API routes or frontend hooks (`apps/web`), they naturally pass `profile.columnProfiles` directly to AI prompt construction routines. If an engineer misses the manual Zod parse, up to 5,000 characters of raw categorical records per column are transmitted directly to Anthropic/OpenAI APIs.
- **Vulnerability Impact**: Mass exfiltration of sensitive business data (customer names, category values, internal codes) and expanded attack surface for adversarial prompt injection.
- **Actionable Recommendation**:
  1. Add an authoritative conversion utility to `packages/engine/src/profile/sheet.ts` and re-export it from `@unsheet/engine`:
     ```typescript
     export function toLLMColumnProfile(profile: ColumnProfile): LLMColumnProfile {
       return LLMColumnProfileSchema.parse(profile);
     }

     export function toLLMSheetProfile(profile: SheetProfile): Omit<SheetProfile, 'columnProfiles'> & { columnProfiles: LLMColumnProfile[] } {
       return {
         ...profile,
         columnProfiles: profile.columnProfiles.map(toLLMColumnProfile),
       };
     }
     ```
  2. Document in `packages/engine/README.md` and architecture guides that `toLLMProfile` is mandatory before passing metadata to any LLM prompt generator.

---

### [SEC-P2-03] Unchecked Prototype Pollution in Sheet Names Permitted in `SheetProfile` & `DashboardSpec`
- **Severity**: **High**
- **STRIDE Category**: Elevation of Privilege / Tampering
- **Target**: `packages/contracts/src/profile.ts` (line 105), `packages/engine/src/profile/joins.ts` (lines 142–145), `packages/engine/src/specgen/specgen.ts` (line 59)
- **Description**:  
  While column keys are strictly validated with `SafeIdentifierSchema` forbidding `__proto__`, `constructor`, `prototype`, `SheetProfileSchema.sheetName` is defined as:
  ```typescript
  sheetName: z.string().min(1).max(128)
  ```
  No validation against `FORBIDDEN_OBJECT_KEYS` exists for sheet names. If a user uploads a spreadsheet with a worksheet named `__proto__` or `constructor`:
  - `profileSheet` outputs `sheetProfile.sheetName = '__proto__'`.
  - `findJoinCandidates` emits candidates with `fromSheet: '__proto__'` and `toSheet: '__proto__'`.
  - `detectDrift` outputs `report.sourceSheetName = '__proto__'`.
  - `generateDashboardSpec` incorporates `profile.sheetName` into titles and descriptions.
  - In downstream web components and analytics state managers, developers frequently index sheets or graphs via dictionary lookups (`sheetsByName[profile.sheetName] = profile` or `joinGraph[candidate.fromSheet] = ...`). Setting `sheetsByName['__proto__'] = profile` directly pollutes `Object.prototype`.
- **Vulnerability Impact**: Prototype pollution in downstream state management and data stores, leading to potential privilege escalation or logic subversion.
- **Actionable Recommendation**:
  1. Update `SheetProfileSchema.sheetName` in `packages/contracts/src/profile.ts`:
     ```typescript
     sheetName: z
       .string()
       .min(1)
       .max(128)
       .refine(
         (val) => !FORBIDDEN_OBJECT_KEYS.includes(val.toLowerCase() as typeof FORBIDDEN_OBJECT_KEYS[number]),
         { message: 'Sheet name cannot match prototype properties (__proto__, constructor, prototype)' }
       )
     ```
  2. In `profileSheet`, sanitize incoming sheet names by prefixing forbidden keywords with `safe_`:
     ```typescript
     const safeSheetName = FORBIDDEN_OBJECT_KEYS.includes(sheet.name.toLowerCase() as any)
       ? `safe_${sheet.name}`
       : sheet.name;
     ```

---

### [SEC-P2-04] Unhandled `TypeError` Crash in Value Sanitizers on Null-Prototype Cell Values
- **Severity**: **Medium**
- **STRIDE Category**: Denial of Service (DoS)
- **Target**: `packages/engine/src/profile/stats.ts` (lines 24, 67, 174, 245)
- **Description**:  
  In `packages/engine/src/profile/stats.ts`:
  - Line 24: `let str = String(rawVal).trim();`
  - Line 67: `let str = String(rawVal).trim();`
  - Line 174: `distinctSet.add(String(v));`
  - Line 245: `const key = String(v);`
  
  In modern JavaScript, if an object has a null prototype (`Object.create(null)`), it lacks `Object.prototype.toString`. Calling `String(obj)` on such an object throws:
  ```
  TypeError: Cannot convert object to primitive value
  ```
  Because Phase 1 specifies that row records and cell dictionaries should be created using `Object.create(null)` (Mitigation 4), any nested object or cell value with a null prototype passed into `computeColumnStats` crashes the entire profiling process with an unhandled exception.
- **Vulnerability Impact**: Crash of the profiling engine and denial of service when processing objects created with null prototypes.
- **Actionable Recommendation**:
  Replace bare `String(rawVal)` calls with a defensive coercion utility in `stats.ts`:
  ```typescript
  function toSafeString(val: unknown): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object' && Object.getPrototypeOf(val) === null) {
      return '';
    }
    return String(val);
  }
  ```

---

### [SEC-P2-05] Missing Overlap Constraint in `DashboardSpecSchema` Allows Visual & Render DoS
- **Severity**: **Medium**
- **STRIDE Category**: Denial of Service / Renderer Crash
- **Target**: `packages/contracts/src/spec.ts` (lines 301–311)
- **Description**:  
  Focus 5 requires that generated dashboard specifications respect `x + w <= 12`, max 50 widgets, and non-overlapping coordinates. 
  
  While `packages/engine/src/specgen/specgen.ts` guarantees non-overlapping layout generation in its deterministic rule engine, the authoritative schema `DashboardSpecSchema` in `packages/contracts/src/spec.ts` only validates individual widget grid bounds (`x + w <= 12`). It has **no schema-level constraint verifying that widgets do not overlap**.
  
  Because `DashboardSpecSchema` is used to validate client-supplied specifications in `CreateShareLinkRequestSchema`, `SpecRefinementResponseSchema`, and database storage:
  - An attacker or misbehaving LLM can craft a specification containing 50 widgets stacked at the identical coordinates (`x: 0, y: 0, w: 12, h: 12`).
  - When rendered in `apps/web`, 50 overlapping WebGL/Canvas/SVG chart instances render synchronously in the same grid cell, triggering severe rendering lag, canvas context loss, and potential browser crashes.
- **Vulnerability Impact**: Client-side visual corruption and UI thread freeze when loading shared or LLM-refined dashboards.
- **Actionable Recommendation**:
  Add a non-overlapping refinement to `DashboardSpecSchema` in `packages/contracts/src/spec.ts`:
  ```typescript
  export const DashboardSpecSchema = z.object({ ... })
    .refine((spec) => {
      for (let i = 0; i < spec.widgets.length; i++) {
        for (let j = i + 1; j < spec.widgets.length; j++) {
          const a = spec.widgets[i]!.grid;
          const b = spec.widgets[j]!.grid;
          const xOverlap = a.x < b.x + b.w && a.x + a.w > b.x;
          const yOverlap = a.y < b.y + b.h && a.y + a.h > b.y;
          if (xOverlap && yOverlap) {
            return false;
          }
        }
      }
      return true;
    }, { message: 'Dashboard widgets must not have overlapping grid coordinates' });
  ```

---

### [SEC-P2-06] Ineffective Fallback Regex in Value Sanitizers with Leading Whitespace
- **Severity**: **Medium**
- **STRIDE Category**: Tampering / Formula Injection
- **Target**: `packages/engine/src/profile/stats.ts` (lines 51, 93)
- **Description**:  
  In `sanitizeCategoryValue` (line 51) and `sanitizeSampleValue` (line 93), if single-quote prefixing fails schema validation, the fallback is:
  ```typescript
  return str.replace(/^[=+\-@\t\r\n|]+/g, '').slice(0, 40);
  ```
  The regex `/^[=+\-@\t\r\n|]+/g` uses the start-of-string anchor `^` without preceding whitespace handling. If `str` contains leading spaces before the formula trigger character (e.g. `" =cmd"`), the regex does not match because the first character is a space (`0x20`). The trigger character `=` is never stripped, and the dangerous string is returned unneutralized.
- **Vulnerability Impact**: Bypasses the emergency fallback, returning un-sanitized formula injection strings that subsequently fail schema parsing or trigger CSV execution.
- **Actionable Recommendation**:
  Trim leading whitespace before stripping, or match leading whitespace in the regex:
  ```typescript
  return str.trimStart().replace(/^[=+\-@\t\r\n|]+/g, '').slice(0, 40);
  ```

---

### [SEC-P2-07] Unbounded Levenshtein Calculation Complexity in Drift Detection ($O(M \cdot N)$)
- **Severity**: **Medium**
- **STRIDE Category**: Denial of Service (DoS)
- **Target**: `packages/engine/src/drift/similarity.ts` (lines 4–38, 93–115), `packages/engine/src/drift/drift.ts` (lines 205–207)
- **Description**:  
  In `detectDrift`, when matching missing template columns to added sheet columns:
  ```typescript
  for (const mKey of missingColumns) {
    for (const added of addedColumns) {
      const simKey = calculateColumnSimilarity(mKey, added.columnKey);
      const simName = calculateColumnSimilarity(mKey, added.originalName);
      ...
    }
  }
  ```
  `calculateColumnSimilarity` runs dynamic programming `levenshteinDistance(cleanA, cleanB)` which allocates two $(N+1)$-element arrays and executes $M \times N$ matrix operations.
  
  Because `originalName` can be up to 256 characters long, comparing two 256-character strings executes $256 \times 256 = 65,536$ operations per pair. For 200 missing columns and 200 added columns, this results in $200 \times 200 \times 2 = 80,000$ string comparisons and over $2.6 \times 10^9$ inner loop cycles without any string truncation or early length-difference pruning.
- **Vulnerability Impact**: Significant CPU freeze and latency during schema drift analysis on wide workbooks.
- **Actionable Recommendation**:
  1. Truncate strings in `calculateColumnSimilarity` to a maximum comparison length of 40 characters:
     ```typescript
     const cleanA = a.toLowerCase().trim().slice(0, 40);
     const cleanB = b.toLowerCase().trim().slice(0, 40);
     ```
  2. Add early-exit length filtering before calling `levenshteinDistance`:
     ```typescript
     if (Math.abs(cleanA.length - cleanB.length) > 15) {
       return tokenJaccardSimilarity(cleanA, cleanB);
     }
     ```

---

### [SEC-P2-08] Inconsistent Cardinality Threshold Between Profiling and Drift Role Inference
- **Severity**: **Low**
- **STRIDE Category**: Data Inconsistency
- **Target**: `packages/engine/src/profile/inference.ts` (line 424), `packages/engine/src/drift/drift.ts` (lines 75–90)
- **Description**:  
  In `inference.ts`, columns with distinct counts $\le 50$ are inferred as `'category'`. In `drift.ts`, `extractExpectedColumns` infers column types by examining table widget configurations and falls back to text if no specific pattern matches. When comparing an expected template against a new sheet profile, this can cause spurious `typeMismatches` where a column was classified as `'category'` by the profiler but `'text'` by drift extraction.
- **Vulnerability Impact**: Inaccurate drift confidence scoring and unnecessary coercion warnings for valid columns.
- **Actionable Recommendation**:
  Always pass `templateProfile` into `detectDrift` when available, and synchronize fallback inference in `extractExpectedColumns` with `inferColumnType`.

---

### [SEC-P2-09] Non-Standard Currency Code Fallback to `'USD'` in Type Inference
- **Severity**: **Low**
- **STRIDE Category**: Data Integrity
- **Target**: `packages/engine/src/profile/inference.ts` (line 191)
- **Description**:  
  In `detectCurrencyCode`, if a column name matches a currency keyword (e.g. `total_cost` or `budget`) but contains no recognized currency symbol (`$`, `€`, `£`, `¥`, `₹`) or ISO code (`EUR`, `GBP`, etc.), the function defaults to returning `'USD'`. For international workbooks denominated in other currencies without symbols, this injects an incorrect USD currency binding into generated dashboard specs.
- **Vulnerability Impact**: Displaying incorrect currency units on financial charts.
- **Actionable Recommendation**:
  Return `undefined` instead of defaulting to `'USD'` when no currency indicator is detected:
  ```typescript
  return undefined;
  ```

---

## 4. Threat Mitigation Verification Matrix

| Mitigation ID & Title | Invariant / Target Requirement | Enforcement Status | Phase 2 Audit Finding |
|---|---|---|---|
| **Mitigation 4**: Prototype Pollution Defense | Rejection of `__proto__`, `constructor`, `prototype`; safe identifiers for keys/IDs | **PARTIAL** | Column keys and widget IDs strictly sanitized; however, `SheetProfileSchema.sheetName` accepts prototype keywords (**SEC-P2-03**). |
| **Mitigation 8**: Prompt Injection & Data Privacy | Zero raw row data; sample values capped (<=5 items, <=40 chars); omit `topValues` in LLM profile | **PARTIAL** | Contracts strictly enforce `LLMColumnProfileSchema`; however, engine lacks transformation helper, exposing raw `topValues` (**SEC-P2-02**). |
| **Mitigation 9**: DuckDB / Engine Resource Defense | Hard execution bounds; no runaway loops or Cartesian explosion | **FAILED** | `findJoinCandidates` exhibits $O(S^2 \cdot C^2 \cdot R)$ Cartesian explosion ($3 \times 10^{12}$ ops), freezing the event loop (**SEC-P2-01**). |
| **Mitigation 5 (Profiling)**: Formula Neutralization in Metadata | Neutralize `=, +, -, @, \t, \r, \n, \|` in samples and categories | **ENFORCED** | Verified. `sanitizeSampleValue` and `sanitizeCategoryValue` successfully neutralize formula triggers and pass contract schemas. |
| **Mitigation 9 (SpecGen)**: Grid & Layout Integrity | $x + w \le 12$, max 50 widgets, non-overlapping coordinates | **PARTIAL** | `generateDashboardSpec` generates non-overlapping layouts; however, `DashboardSpecSchema` lacks an overlap validation refinement (**SEC-P2-05**). |

---

## 5. Algorithmic Complexity & ReDoS Audit

### Regex ReDoS Verification
An AST and regex pattern audit was performed on all regular expressions in Phase 2 deliverables:
1. `ISO_DATE_REGEX` (`inference.ts`): `/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/`  
   **Result**: SAFE. Strictly anchored, bounded digit counts, zero overlapping quantifiers.
2. `OTHER_DATE_REGEX` (`inference.ts`): Non-overlapping alternatives with bounded digit quantifiers (`\d{1,2}`, `\d{2,4}`).  
   **Result**: SAFE.
3. `CURRENCY_SYMBOL_REGEX` (`inference.ts`): Anchored disjoint alternatives (`^[$€£¥₹]`, `\((?:[$€£¥₹]\s*)?[\d,]+(?:\.\d+)?\)`).  
   **Result**: SAFE.
4. Percentage Regex (`inference.ts`): `/^-?[\d,]+(?:\.\d+)?\s*%$/`  
   **Result**: SAFE. Decimal point is disjoint from `[\d,]`.
5. Identifier Tokenizer (`similarity.ts`): `split(/[^a-z0-9]+/)` and camelCase replacer.  
   **Result**: SAFE. Single linear pass.

### Algorithmic Complexity Findings
- **`joins.ts`**: CRITICAL algorithmic bottleneck. Repeated inner-loop allocation across $15.2 \times 10^6$ column pairs violates resource bounds (**SEC-P2-01**).
- **`similarity.ts`**: Unbounded $256 \times 256$ Levenshtein dynamic programming matrices across $40,000$ column pairs in `drift.ts` (**SEC-P2-07**).

---

## 6. Conclusion & Prioritized Remediation Roadmap

Phase 2 successfully achieves high-fidelity statistical profiling, clean type inference, and robust deterministic layout generation that satisfies strict grid constraints. The formula injection sanitizers and contract schemas operate effectively.

To prevent denial of service and data exfiltration, the following fixes are prioritized:

### Priority P0 (Immediate Pre-Phase 3 Gate):
1. **Fix Cartesian Explosion in `findJoinCandidates` (**SEC-P2-01**)**:
   - Filter `areNamesCompatible` *before* allocating sets.
   - Pre-filter columns to identifiers/keys only.
   - Pre-cache value sets per column.
   - Sample row data (max 1,000 rows).
2. **Export `toLLMProfile` Helper (**SEC-P2-02**)**:
   - Implement `toLLMColumnProfile` and `toLLMSheetProfile` in `@unsheet/engine` to guarantee that `topValues` are never accidentally passed to LLMs.
3. **Neutralize Prototype Keywords in Sheet Names (**SEC-P2-03**)**:
   - Validate `sheetName` against `FORBIDDEN_OBJECT_KEYS` in `SheetProfileSchema`.
   - Sanitize sheet names in `profileSheet`.

### Priority P1 (High Priority):
4. **Fix Null-Prototype String Crashes (**SEC-P2-04**)**:
   - Implement `toSafeString` across `stats.ts` and `inference.ts`.
5. **Add Overlap Refinement to `DashboardSpecSchema` (**SEC-P2-05**)**:
   - Enforce non-overlapping grid rectangles at the contract validation layer.
6. **Correct Fallback Replacement Regex (**SEC-P2-06**)**:
   - Trim leading whitespace before executing emergency formula trigger stripping.
7. **Bound Levenshtein String Lengths in Similarity Engine (**SEC-P2-07**)**:
   - Truncate strings to max 40 characters in `calculateColumnSimilarity`.

### Priority P2 (Quality & Correctness):
8. **Align Role Inference Cardinality in Drift (**SEC-P2-08**)**.
9. **Remove Inappropriate `'USD'` Fallback in Type Inference (**SEC-P2-09**)**.
