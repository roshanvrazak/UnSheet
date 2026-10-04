# Phase 3 Security Audit Report: DuckDB-WASM, Query Engine, Dashboard Components & Privacy

**Audit Target**: Unsheet Phase 3 Deliverables  
- Web Application Security Headers & CSP: `apps/web/next.config.mjs`  
- DuckDB-WASM Sandbox & Executor: `apps/web/lib/query/duckdb.ts`, `apps/web/lib/query/executor.ts`  
- Query Compilation & In-Memory Engine: `packages/engine/src/query/**` (`sql.ts`, `planner.ts`, `validation.ts`, `memory.ts`, `index.ts`)  
- Dashboard UI Components & Renderers: `apps/web/components/dashboard/**` (`DashboardRenderer.tsx`, `FilterBar.tsx`, `WidgetContainer.tsx`, `WidgetErrorBoundary.tsx`, `AccessibleDataTable.tsx`, `widgets/**`)  
- Client-Side Privacy Guarantees: `apps/web/app/**`, `apps/web/lib/**`  
**Auditor**: Independent Application Security Auditor  
**Date**: October 4, 2026  
**Status**: Completed  
**Compliance Standard**: `docs/THREAT_MODEL.md` (Mitigations 1, 3, 4, 5, 6, 7, 8, 9, 10, 14), STRIDE Methodology  

---

## 1. Executive Summary

An exhaustive independent application security audit was conducted on the Phase 3 deliverables of Unsheet. This phase delivers the browser-side query execution infrastructure (DuckDB-WASM integration and fallback synchronous in-memory SQL execution engine), structured query planning and validation, responsive 12-column interactive dashboard rendering with accessibility companions, global filtering, and client-side data privacy safeguards.

The Phase 3 implementation demonstrates adherence to several baseline defensive patterns:
- **Zero `dangerouslySetInnerHTML`**: Enforced across all dashboard widgets, table cells, error cards, and chart companions. All cell data and metric titles are safely rendered through standard React JSX text node escaping.
- **Client-Side Privacy Boundary**: No third-party analytics libraries (`@vercel/analytics`, `posthog-js`, `mixpanel`, `sentry`), telemetry beacons, or background remote HTTP requests were introduced. Spreadsheets are processed entirely on-device in browser memory.
- **SQL Identifier Quoting & Literal Escaping**: `quoteIdentifier` asserts identifiers against `SafeIdentifierSchema` and applies double-quoting (`"ident"`). `escapeSqlLiteral` safely handles booleans, numbers, nulls, and standard single-quote escaping (`' -> ''`).
- **Widget Fault Tolerance**: `DashboardRenderer` and `WidgetContainer` isolate widget failures behind `WidgetErrorBoundary` and render user-friendly, localized `ErrorCardWidget` elements without crashing the page.

However, the audit revealed **Critical** and **High** severity vulnerabilities in Content Security Policy configuration, algorithmic memory exhaustion, regex-based SQL validation, DuckDB connection concurrency, and prototype pollution:
1. **Critical CSP Vulnerability (`'unsafe-inline'` & Missing `frame-ancestors 'none'`)**: `apps/web/next.config.mjs` configures `script-src` with `'unsafe-inline'`, completely negating CSP script injection protections. Furthermore, CSP omits `frame-ancestors 'none'` and the HTTP response headers omit `Strict-Transport-Security` (HSTS), violating Mitigation 7 of the Threat Model.
2. **Critical Denial of Service via Argument Call Stack Exhaustion in `computeAggregation`**: In `packages/engine/src/query/memory.ts`, `min` and `max` aggregations execute `Math.min(...numValues)` and `Math.max(...numValues)`. When querying datasets up to Unsheet's allowed ceiling of 200,000 rows (or any dataset exceeding 65,536 elements in Safari/WebKit), the argument spread immediately throws an unhandled `RangeError: Maximum call stack size exceeded`, crashing the engine.
3. **High Severity Regex SQL Validation Flaws (False Positives & Denylist Bypasses)**: `SafeSqlQuerySchema` in `@unsheet/contracts` uses a blacklist regex rather than an AST parser. It causes critical false positives by blocking legitimate user queries containing words like `'create'`, `'update'`, `'drop'`, or semicolons inside string literals or filters (e.g. `WHERE status = 'create'`), while failing to block dangerous DuckDB functions not in the hardcoded list (e.g. `read_ndjson`, `scan_csv`, `glob`, `current_setting`, `duckdb_secrets`, `duckdb_settings`).
4. **High Severity DuckDB-WASM Connection Concurrency & Worker Deadlock**: `apps/web/lib/query/duckdb.ts` relies on a single shared `connInstance` singleton. When a dashboard renders multiple widgets simultaneously, concurrent query executions on this single connection race and deadlock. Furthermore, if a query times out, `conn.cancelSent()` fails to recycle or reset the worker connection, leaving subsequent queries permanently broken.
5. **High Severity Fallback Spec Bypass in `DashboardRenderer`**: When an invalid spec fails schema parsing, `DashboardRenderer` falls back to raw object properties and renders `widgets` without enforcing the 50-widget ceiling, enabling a client-side rendering Denial of Service.
6. **High Severity External CDN Dependency Violating CSP & Privacy**: `apps/web/lib/query/duckdb.ts` invokes `duckdb.getJsDelivrBundles()`, directing the browser to fetch Wasm and worker bundles from `cdn.jsdelivr.net`. This domain is blocked by the restrictive CSP in `next.config.mjs` and violates Mitigation 14 and offline privacy guarantees.
7. **Medium Severity Formula Injection in Displayed Table Cells**: `TableWidget`, `PivotTableWidget`, and `AccessibleDataTable` display raw formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`, `|`) without neutralization. Copying cells to clipboard and pasting into Excel exposes users to DDE/CSV injection.
8. **Medium Severity Prototype Pollution in `PivotTableWidget`**: Group totals use unconstrained object literals (`{}`), causing dimension values like `'constructor'` or `'__proto__'` to corrupt prototype properties and display invalid object function strings.

A total of **12 findings** were identified: **2 Critical**, **4 High**, **4 Medium**, and **2 Low**.

---

## 2. Findings Summary Matrix

| ID | Title | Severity | STRIDE Category | Affected Component |
|---|---|---|---|---|
| **SEC-P3-01** | Permissive CSP with `'unsafe-inline'` & Missing `frame-ancestors 'none'` in `next.config.mjs` | **Critical** | Elevation of Privilege / Tampering | `apps/web/next.config.mjs` |
| **SEC-P3-02** | Argument Call Stack Exhaustion (`RangeError` DoS) in In-Memory `Math.min` / `Math.max` Spread | **Critical** | Denial of Service | `packages/engine/src/query/memory.ts` |
| **SEC-P3-03** | Incomplete Regex SQL Validation: Keyword False Positives on Data & Blindness to Dangerous Functions | **High** | Elevation of Privilege / DoS | `packages/contracts/src/query.ts`, `packages/engine/src/query/sql.ts` |
| **SEC-P3-04** | DuckDB-WASM Singleton Connection Collision & Deadlock Under Concurrent Widget Execution | **High** | Denial of Service | `apps/web/lib/query/duckdb.ts` |
| **SEC-P3-05** | Uncapped Widget Rendering in `DashboardRenderer` Fallback Branch Bypasses 50-Widget Limit | **High** | Denial of Service | `apps/web/components/dashboard/DashboardRenderer.tsx` |
| **SEC-P3-06** | External jsDelivr CDN Bundle Dependency Violates CSP & Browser-First Offline Privacy | **High** | Denial of Service / Supply Chain | `apps/web/lib/query/duckdb.ts`, `apps/web/next.config.mjs` |
| **SEC-P3-07** | Missing Formula Neutralization in Displayed Table Cells Enables Clipboard CSV Injection | **Medium** | Tampering / CSV Injection | `apps/web/components/dashboard/widgets/TableWidget.tsx`, `AccessibleDataTable.tsx`, `PivotTableWidget.tsx` |
| **SEC-P3-08** | Prototype Pollution & State Corruption in `PivotTableWidget` Totals Dictionaries | **Medium** | Elevation of Privilege / Tampering | `apps/web/components/dashboard/widgets/PivotTableWidget.tsx` |
| **SEC-P3-09** | Grouping Delimiter Collision (`:::`) in In-Memory Query Engine Dimension Aggregations | **Medium** | Tampering / Data Integrity | `packages/engine/src/query/memory.ts` |
| **SEC-P3-10** | Unescaped SQL `LIKE` Wildcards (`%`, `_`) in Filter Predicate Compilation | **Medium** | Tampering / Semantic Alteration | `packages/engine/src/query/sql.ts` |
| **SEC-P3-11** | Incomplete Error Message Sanitization Leaks Windows Paths and Local Usernames | **Low** | Information Disclosure | `apps/web/components/dashboard/widgets/ErrorCardWidget.tsx` |
| **SEC-P3-12** | Missing `Strict-Transport-Security` (HSTS) Header in Security Configuration | **Low** | Information Disclosure / MITM | `apps/web/next.config.mjs` |

---

## 3. Detailed Audit Findings

### [SEC-P3-01] Permissive CSP with `'unsafe-inline'` & Missing `frame-ancestors 'none'` in `next.config.mjs`
- **Severity**: **Critical**
- **STRIDE Category**: Elevation of Privilege / Tampering / Clickjacking
- **Target**: `apps/web/next.config.mjs` (lines 16–22)
- **Description**:  
  `apps/web/next.config.mjs` defines the Content Security Policy as follows:
  ```javascript
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' wasm-unsafe-eval; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self';",
  }
  ```
  This configuration violates Mitigation 7 of `docs/THREAT_MODEL.md` in multiple ways:
  1. **`'unsafe-inline'` in `script-src`**: The inclusion of `'unsafe-inline'` allows any inline `<script>` tags, inline event attributes (`onload`, `onerror`), and `javascript:` URIs to execute without restriction. This completely neutralizes the primary XSS mitigation provided by CSP. The Phase 3 requirements specifically mandate "CSP, security headers, X-Frame-Options, no inline unsafe scripts".
  2. **Missing `frame-ancestors 'none'`**: Modern browser engines (Chrome, Firefox, Safari) follow W3C CSP Level 2/3 and prioritize `frame-ancestors` over `X-Frame-Options: DENY`. Because `frame-ancestors 'none'` is omitted from the CSP header, the application remains vulnerable to UI redressing and clickjacking if framed in contexts where legacy headers are superseded or not enforced.
- **Vulnerability Impact**: Complete loss of defense-in-depth script execution restrictions; potential XSS vulnerability exploitation if any client-side injection primitive arises; exposure to framing/clickjacking attacks.
- **Actionable Recommendation**:
  Update `apps/web/next.config.mjs` to strip `'unsafe-inline'` from `script-src` and add `frame-ancestors 'none'`. For WebAssembly in modern browsers, retain `wasm-unsafe-eval` (or `'unsafe-eval'` for legacy Wasm compilation engines):
  ```javascript
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' wasm-unsafe-eval 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';",
  }
  ```

---

### [SEC-P3-02] Argument Call Stack Exhaustion (`RangeError` DoS) in In-Memory `Math.min` / `Math.max` Spread
- **Severity**: **Critical**
- **STRIDE Category**: Denial of Service (DoS) / Algorithmic Complexity
- **Target**: `packages/engine/src/query/memory.ts` (lines 193–212)
- **Description**:  
  In `packages/engine/src/query/memory.ts`, the in-memory fallback query engine executes numerical aggregations for `min` and `max` using JavaScript array spread syntax:
  ```typescript
  case 'min': {
    const numValues = rawValues
      .map((v) => (typeof v === 'number' ? v : Number(v)))
      .filter((n) => !Number.isNaN(n));
    if (numValues.length === 0) {
      if (rawValues.length === 0) return null;
      return rawValues.sort()[0] ?? null;
    }
    return Math.min(...numValues);
  }

  case 'max': {
    const numValues = rawValues
      .map((v) => (typeof v === 'number' ? v : Number(v)))
      .filter((n) => !Number.isNaN(n));
    if (numValues.length === 0) {
      if (rawValues.length === 0) return null;
      return rawValues.sort()[rawValues.length - 1] ?? null;
    }
    return Math.max(...numValues);
  }
  ```
  In V8 and JavaScriptCore (Safari), spreading an array into function parameters pushes all array elements onto the execution stack frame. The maximum function call argument length is strictly bounded:
  - In Safari (WebKit): argument limit is approximately 65,536 elements.
  - In Chrome / Node (V8): argument limit is approximately 120,000 to 130,000 elements.
  
  Unsheet's Threat Model Mitigation 1 specifically permits spreadsheets with up to **200,000 rows** (`MAX_ROWS = 200_000`). When any workbook with >65,536 rows (or up to 200,000 rows) is profiled or queried with a `min` or `max` aggregation (common for KPI cards, line chart axis bounds, and bar charts), `Math.min(...numValues)` immediately throws an unhandled:
  ```
  RangeError: Maximum call stack size exceeded
  ```
- **Vulnerability Impact**: Immediate client-side Denial of Service; dashboard query execution crashes entirely whenever processing valid large workbooks.
- **Actionable Recommendation**:
  Replace `Math.min(...numValues)` and `Math.max(...numValues)` with linear $O(N)$ accumulation loops or `reduce()` that do not push elements onto the call stack:
  ```typescript
  case 'min': {
    const numValues = rawValues
      .map((v) => (typeof v === 'number' ? v : Number(v)))
      .filter((n) => !Number.isNaN(n));
    if (numValues.length === 0) {
      if (rawValues.length === 0) return null;
      return [...rawValues].sort()[0] ?? null;
    }
    let min = numValues[0]!;
    for (let i = 1; i < numValues.length; i++) {
      if (numValues[i]! < min) min = numValues[i]!;
    }
    return min;
  }

  case 'max': {
    const numValues = rawValues
      .map((v) => (typeof v === 'number' ? v : Number(v)))
      .filter((n) => !Number.isNaN(n));
    if (numValues.length === 0) {
      if (rawValues.length === 0) return null;
      const sorted = [...rawValues].sort();
      return sorted[sorted.length - 1] ?? null;
    }
    let max = numValues[0]!;
    for (let i = 1; i < numValues.length; i++) {
      if (numValues[i]! > max) max = numValues[i]!;
    }
    return max;
  }
  ```
  *(Note: Also spread `[...rawValues]` before `.sort()` to avoid mutating `rawValues` in-place).*

---

### [SEC-P3-03] Incomplete Regex SQL Validation: Keyword False Positives on Data & Blindness to Dangerous Functions
- **Severity**: **High**
- **STRIDE Category**: Elevation of Privilege / Denial of Service
- **Target**: `packages/contracts/src/query.ts` (lines 5–36), `packages/engine/src/query/sql.ts` (line 209)
- **Description**:  
  `SafeSqlQuerySchema` validates queries using substring regular expressions:
  ```typescript
  const FORBIDDEN_SQL_KEYWORD_REGEX =
    /\b(DROP|INSERT|UPDATE|DELETE|ALTER|CREATE|COPY|ATTACH|DETACH|INSTALL|LOAD|PRAGMA)\b/i;

  const FORBIDDEN_SQL_FUNCTION_REGEX =
    /\b(read_csv|read_csv_auto|read_parquet|read_json|read_json_auto|scan_parquet|parquet_scan|write_csv|to_csv|write_parquet|to_parquet|read_blob|read_text)\s*\(/i;

  export const SafeSqlQuerySchema = z
    .string()
    .min(1)
    .max(4000)
    .refine((sql) => /^(SELECT|WITH)\b/i.test(sql.trim()), ...)
    .refine((sql) => !/;[\s\S]*\S/.test(sql.trim()), ...)
    .refine((sql) => !FORBIDDEN_SQL_KEYWORD_REGEX.test(sql), ...)
    .refine((sql) => !FORBIDDEN_SQL_FUNCTION_REGEX.test(sql), ...);
  ```
  This implementation suffers from two major flaws:
  1. **False Positives on Benign Data (Denial of Service)**:
     Because the regex tests the entire SQL string without lexical awareness of string literal boundaries:
     - Any filter value containing words like `'create'`, `'update'`, `'drop'`, `'copy'`, or `'load'` (e.g. `WHERE status = 'create'`, `WHERE notes LIKE '%Please copy this%'`) matches `FORBIDDEN_SQL_KEYWORD_REGEX` and causes the query compiler to reject the query with an error.
     - Any string literal containing a semicolon (e.g. `WHERE title = 'Phase 1; Phase 2'`) triggers `!/;[\s\S]*\S/.test(sql.trim())` ("Multi-statement SQL queries are strictly prohibited"), rejecting legitimate user queries.
  2. **Dangerous Function Bypasses (Denylist Flaw)**:
     DuckDB includes numerous dangerous built-in functions not covered by `FORBIDDEN_SQL_FUNCTION_REGEX`:
     - `read_ndjson(...)`, `read_ndjson_auto(...)`
     - `scan_csv(...)`, `scan_json(...)`, `sniff_csv(...)`
     - `glob(...)`, `getenv(...)`, `current_setting(...)`
     - `duckdb_secrets()`, `duckdb_settings()`, `duckdb_extensions()`, `duckdb_tables()`
     - `checkpoint`, `export_database`, `query_table(...)`
     Queries using these functions pass `SafeSqlQuerySchema` without restriction.
  3. **Threat Model Non-Compliance**:
     `docs/THREAT_MODEL.md` Mitigation 9 explicitly mandates:  
     *"queries are parsed by an AST validator: Enforces single-statement SELECT only; Strictly forbids: INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, ATTACH, DETACH, LOAD, INSTALL, COPY, PRAGMA; Allowlisted table names and column identifiers matching the active SheetModel."*
     The current codebase provides AST validation only for `QueryPlan` (`validateQueryPlanAgainstSheet`), but has zero AST validation for SQL query strings.
- **Vulnerability Impact**: Legitimate user queries on spreadsheets containing standard business terminology (`create`, `update`, `copy`) fail unexpectedly; ad-hoc queries can invoke un-allowlisted DuckDB introspection or scanning functions.
- **Actionable Recommendation**:
  1. In `compileQueryPlanToSql`, validate the structured `QueryPlan` prior to compilation, avoiding string-level keyword regex checks that trip on literal values.
  2. Implement a tokenizer or AST validator that strips or tokenizes SQL string literals (`'...'`) before checking for SQL statement keywords and multi-statement semicolons.
  3. Change the function validation from an ad-hoc blacklist to an allowlist of permitted scalar/aggregation functions (`SUM`, `AVG`, `COUNT`, `MIN`, `MAX`, `ROUND`, `LOWER`, `UPPER`, `SUBSTR`, `DATE_TRUNC`, `COALESCE`, `CAST`), rejecting any un-allowlisted function invocation.

---

### [SEC-P3-04] DuckDB-WASM Singleton Connection Collision & Deadlock Under Concurrent Widget Execution
- **Severity**: **High**
- **STRIDE Category**: Denial of Service (DoS) / State Corruption
- **Target**: `apps/web/lib/query/duckdb.ts` (lines 18–20, lines 161–194)
- **Description**:  
  `apps/web/lib/query/duckdb.ts` stores a single shared connection instance:
  ```typescript
  let dbInstance: AsyncDuckDB | null = null;
  let connInstance: AsyncDuckDBConnection | null = null;
  ```
  In DuckDB-WASM, an `AsyncDuckDBConnection` is single-threaded and executes queries sequentially over a Web Worker message port. 
  When `DashboardRenderer` mounts a dashboard containing multiple widgets (e.g. 6 to 10 widgets), each widget executes its query concurrently in React's `useEffect`:
  ```typescript
  // In DashboardRenderer -> WidgetContainer
  validSpec.widgets.map((widget) => <WidgetContainer widget={widget} useDuckDB={true} />)
  ```
  If `useDuckDB` is active, 6 to 10 queries simultaneously call `conn.query(sql)`. Concurrent queries on a single `AsyncDuckDBConnection` race, corrupting the query message pipeline or throwing `Error: Another query is already in progress`.
  
  Furthermore, the query timeout mechanism in `executeDuckDBQuery`:
  ```typescript
  timer = setTimeout(() => {
    conn.cancelSent().catch(() => {});
    reject(new Error(`DuckDB query execution timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  ```
  If a query times out and `conn.cancelSent()` fails, the timed-out promise rejects, but the worker connection is never recycled or terminated. Subsequent queries sent to `connInstance` fail or remain permanently stuck.
- **Vulnerability Impact**: Total failure of DuckDB query execution under multi-widget dashboard rendering; connection lockup and race conditions.
- **Actionable Recommendation**:
  1. Implement connection pooling or an asynchronous execution queue (mutex/semaphore) to serialize queries sent to DuckDB-WASM:
     ```typescript
     let queryQueue: Promise<unknown> = Promise.resolve();
     export function executeDuckDBQuery(sql: SafeSqlQuery, options?: DuckDBQueryOptions): Promise<QueryResult> {
       const run = async () => { /* execute single query with timeout */ };
       queryQueue = queryQueue.then(run, run);
       return queryQueue as Promise<QueryResult>;
     }
     ```
  2. If a query times out or fails with an internal worker error, invoke `resetDuckDB()` to terminate the unresponsive worker and instantiate a clean connection for future queries.

---

### [SEC-P3-05] Uncapped Widget Rendering in `DashboardRenderer` Fallback Branch Bypasses 50-Widget Limit
- **Severity**: **High**
- **STRIDE Category**: Denial of Service (DoS)
- **Target**: `apps/web/components/dashboard/DashboardRenderer.tsx` (lines 68–88)
- **Description**:  
  `DashboardSpecSchema` strictly bounds the number of widgets to a maximum of 50:
  ```typescript
  widgets: z.array(WidgetSpecSchema).min(1).max(50, 'Dashboard exceeds maximum 50 widgets')
  ```
  However, in `DashboardRenderer.tsx`, if `DashboardSpecSchema.safeParse(spec)` fails:
  ```typescript
  } else if (
    typeof spec === 'object' &&
    spec !== null &&
    Array.isArray((spec as { widgets?: unknown }).widgets) &&
    (spec as { widgets: unknown[] }).widgets.length > 0 &&
    typeof (spec as { title?: unknown }).title === 'string' &&
    (spec as { title: string }).title.trim() !== ''
  ) {
    const rawSpec = spec as Record<string, unknown>;
    validSpec = {
      title: rawSpec.title as string,
      description: typeof rawSpec.description === 'string' ? rawSpec.description : '',
      filters: Array.isArray(rawSpec.filters) ? (rawSpec.filters as FilterSpec[]) : [],
      widgets: rawSpec.widgets as unknown[], // UNBOUNDED ARRAY!
      layout: ...
    };
  }
  ```
  The fallback branch does not cap `widgets`. If an attacker supplies a malformed spec with 1,000 or 10,000 widgets (e.g. via a shared dashboard or adversarial file payload), the renderer iterates over all 10,000 items:
  ```typescript
  {validSpec.widgets.map((widget, index) => <WidgetContainer ... />)}
  ```
  Mounting 10,000 React components, each with its own hooks, state, error boundaries, and query timers, instantly exhausts browser memory and locks the main thread.
- **Vulnerability Impact**: Client-side Denial of Service; browser tab crashes upon loading malformed or oversized dashboard specifications.
- **Actionable Recommendation**:
  Enforce the 50-widget ceiling in the fallback branch:
  ```typescript
  widgets: (rawSpec.widgets as unknown[]).slice(0, 50),
  ```
  Additionally, validate layout gap and padding values:
  ```typescript
  layout: {
    columns: 12,
    gap: Math.max(0, Math.min(64, Number(rawSpec.layout?.gap) || 16)),
    padding: Math.max(0, Math.min(64, Number(rawSpec.layout?.padding) || 16)),
  }
  ```

---

### [SEC-P3-06] External jsDelivr CDN Bundle Dependency Violates CSP & Browser-First Offline Privacy
- **Severity**: **High**
- **STRIDE Category**: Denial of Service / Supply Chain Integrity / Information Disclosure
- **Target**: `apps/web/lib/query/duckdb.ts` (lines 56–60)
- **Description**:  
  In `apps/web/lib/query/duckdb.ts`:
  ```typescript
  const duckdb = await import('@duckdb/duckdb-wasm');
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  ```
  `getJsDelivrBundles()` instructs the browser to download WebAssembly and Worker scripts from `https://cdn.jsdelivr.net`.
  This creates three security and architectural issues:
  1. **Blocked by CSP**: The Content Security Policy in `apps/web/next.config.mjs` sets `connect-src 'self' blob: data:;` and `worker-src 'self' blob:;`. Because `cdn.jsdelivr.net` is not allowlisted, modern browsers will block the script and Wasm fetch, causing DuckDB initialization to fail.
  2. **Breaches Threat Model Mitigation 7**: Mitigation 7 explicitly requires:
     `worker-src 'self' blob: (restricted to self-hosted engine Web Workers)`
  3. **Privacy & Offline Degradation**: Fetching code from an external CDN leaks the user's IP address, User-Agent, and usage timestamp to a third party, conflicting with Unsheet's core promise of "100% In-Browser: zero server upload, offline-capable".
- **Vulnerability Impact**: DuckDB-WASM fails to load in CSP-compliant browsers; third-party network metadata leakage.
- **Actionable Recommendation**:
  Self-host the DuckDB-WASM bundles (`duckdb-mvp.wasm`, `duckdb-eh.wasm`, worker scripts) in `apps/web/public/duckdb/` and instantiate DuckDB using local relative URLs:
  ```typescript
  const DUCKDB_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
      mainModule: '/duckdb/duckdb-mvp.wasm',
      mainWorker: '/duckdb/duckdb-browser-mvp.worker.js',
    },
    eh: {
      mainModule: '/duckdb/duckdb-eh.wasm',
      mainWorker: '/duckdb/duckdb-browser-eh.worker.js',
    },
  };
  const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES);
  ```

---

### [SEC-P3-07] Missing Formula Neutralization in Displayed Table Cells Enables Clipboard CSV Injection
- **Severity**: **Medium**
- **STRIDE Category**: Tampering / CSV/Formula Injection
- **Target**: `apps/web/components/dashboard/widgets/TableWidget.tsx` (line 221), `AccessibleDataTable.tsx` (line 137), `PivotTableWidget.tsx` (line 142)
- **Description**:  
  When tabular data is rendered in `TableWidget`, `AccessibleDataTable`, and `PivotTableWidget`, cell values are formatted via `formatDisplayValue(val, format)`:
  ```typescript
  // apps/web/lib/utils.ts
  export function formatDisplayValue(value: unknown, format?: DisplayFormat): string {
    ...
    // Fallback to string representation
    const str = String(value);
    const prefix = format?.prefix ?? '';
    const suffix = format?.suffix ?? '';
    return `${prefix}${str}${suffix}`;
  }
  ```
  If a spreadsheet cell contains a malicious formula trigger string such as:
  `=cmd|' /C calc'!A0`, `+cmd|' /C calc'!A0`, `-2+5`, or `@SUM(...)`
  the cell displays the raw string without prepending a single quote (`'`).
  
  While React text rendering safely prevents in-browser XSS, users frequently copy records from dashboard tables to their clipboard to paste them into desktop spreadsheet applications (Microsoft Excel, LibreOffice Calc, or Google Sheets). When pasted, Excel treats leading `=`, `+`, `-`, `@`, `\t`, or `\r` characters as executable formulas (Dynamic Data Exchange / DDE injection).
- **Vulnerability Impact**: Remote Code Execution or unauthorized macro/command execution on victim machines when dashboard table data is copied and pasted into external spreadsheet software.
- **Actionable Recommendation**:
  Sanitize string values in `formatDisplayValue` by prefixing formula trigger characters (`=, +, -, @, \t, \r, |`) with a single quote (`'`):
  ```typescript
  export function sanitizeFormulaString(str: string): string {
    if (/^[=+\-@\t\r\n|]/.test(str) || /^[=+\-@\t\r\n|]/.test(str.trimStart())) {
      return `'${str}`;
    }
    return str;
  }
  ```
  Apply `sanitizeFormulaString` in `formatDisplayValue` for all string outputs.

---

### [SEC-P3-08] Prototype Pollution & State Corruption in `PivotTableWidget` Totals Dictionaries
- **Severity**: **Medium**
- **STRIDE Category**: Elevation of Privilege / Tampering
- **Target**: `apps/web/components/dashboard/widgets/PivotTableWidget.tsx` (lines 47–60, line 149)
- **Description**:  
  In `PivotTableWidget.tsx`, row and column totals are computed using plain object literals:
  ```typescript
  const rTotals: Record<string, number> = {};
  const cTotals: Record<string, number> = {};

  for (const rVal of rList) {
    let rSum = 0;
    for (const cVal of cList) {
      const val = cellMap.get(`${rVal}:::${cVal}`) ?? 0;
      rSum += val;
      cTotals[cVal] = (cTotals[cVal] ?? 0) + val;
    }
    rTotals[rVal] = rSum;
    gTotal += rSum;
  }
  ```
  When the dimension column contains values such as `'constructor'`, `'__proto__'`, or `'prototype'`:
  1. `cTotals['constructor']` accesses `Object.prototype.constructor`, which is the function `[Function: Object]`.
  2. Adding `val` results in string concatenation (`"[Function: Object]100"`), which fails numeric parsing.
  3. In line 149:
     ```typescript
     formatDisplayValue(rowTotals[rVal] ?? 0, primaryMeasure.format)
     ```
     `rowTotals['constructor']` resolves to `[Function: Object]`, rendering `function Object() { [native code] }` directly into the dashboard table.
  4. Assigning to `rTotals['__proto__']` alters the object's prototype.
- **Vulnerability Impact**: Dashboard visual corruption, NaN matrix totals, and potential prototype pollution.
- **Actionable Recommendation**:
  Initialize total dictionaries using `Object.create(null)` or ES6 `Map<string, number>`:
  ```typescript
  const rTotals = new Map<string, number>();
  const cTotals = new Map<string, number>();

  for (const rVal of rList) {
    let rSum = 0;
    for (const cVal of cList) {
      const val = cellMap.get(`${rVal}:::${cVal}`) ?? 0;
      rSum += val;
      cTotals.set(cVal, (cTotals.get(cVal) ?? 0) + val);
    }
    rTotals.set(rVal, rSum);
    gTotal += rSum;
  }
  ```

---

### [SEC-P3-09] Grouping Delimiter Collision (`:::`) in In-Memory Query Engine Dimension Aggregations
- **Severity**: **Medium**
- **STRIDE Category**: Tampering / Data Integrity
- **Target**: `packages/engine/src/query/memory.ts` (lines 257–266)
- **Description**:  
  In `packages/engine/src/query/memory.ts`, grouping for multi-dimensional aggregation generates group keys by joining dimensions with `:::`:
  ```typescript
  for (const row of filteredRows) {
    const key = plan.dimensions
      .map((dim) => String(row[dim] ?? ''))
      .join(':::');
    let grp = groupMap.get(key);
    if (!grp) {
      grp = { sample: row, rows: [] };
      groupMap.set(key, grp);
    }
    grp.rows.push(row);
  }
  ```
  If dimension data contains the delimiter `:::`, distinct tuples produce identical keys. For example:
  - Row 1: `dimA = "US:::"`, `dimB = "CA"` -> Key: `"US::::::CA"`
  - Row 2: `dimA = "US"`, `dimB = ":::CA"` -> Key: `"US::::::CA"`
  The two distinct tuples are merged into a single grouping bucket, corrupting aggregation totals. Additionally, calling `String(row[dim])` on null-prototype objects (`Object.create(null)`) throws `TypeError: Cannot convert object to primitive value`.
- **Vulnerability Impact**: Data corruption in analytical charts and pivot summaries; unexpected `TypeError` crash on null-prototype cell objects.
- **Actionable Recommendation**:
  Encode group keys unambiguously using structured JSON serialization with safe string conversion:
  ```typescript
  const key = JSON.stringify(plan.dimensions.map((dim) => safeToString(row[dim])));
  ```

---

### [SEC-P3-10] Unescaped SQL `LIKE` Wildcards (`%`, `_`) in Filter Predicate Compilation
- **Severity**: **Medium**
- **STRIDE Category**: Tampering / Semantic Alteration
- **Target**: `packages/engine/src/query/sql.ts` (lines 127–141)
- **Description**:  
  In `packages/engine/src/query/sql.ts`:
  ```typescript
  case 'contains': {
    const sanitized = String(value ?? '').replace(/'/g, "''");
    return `${col} LIKE '%${sanitized}%'`;
  }

  case 'starts_with': {
    const sanitized = String(value ?? '').replace(/'/g, "''");
    return `${col} LIKE '${sanitized}%'`;
  }

  case 'ends_with': {
    const sanitized = String(value ?? '').replace(/'/g, "''");
    return `${col} LIKE '%${sanitized}'`;
  }
  ```
  While single quotes are escaped (`' -> ''`), SQL wildcard characters `%` (any characters) and `_` (single character) and the escape character `\` are not escaped.
  If a user filters for a string like `"100%"` or `"item_1"`, the filter is compiled as:
  `"col" LIKE '%100%%'` or `"col" LIKE '%item_1%'`
  The `%` and `_` inside `value` act as active wildcards rather than literal characters.
- **Vulnerability Impact**: Unexpected wildcard expansion, inaccurate filter results, and potential ReDoS/performance degradation in SQL pattern matching.
- **Actionable Recommendation**:
  Escape `\`, `%`, and `_` and declare an explicit `ESCAPE '\\'` clause:
  ```typescript
  case 'contains': {
    const escaped = String(value ?? '')
      .replace(/'/g, "''")
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
    return `${col} LIKE '%${escaped}%' ESCAPE '\\'`;
  }
  ```

---

### [SEC-P3-11] Incomplete Error Message Sanitization Leaks Windows Paths and Local Usernames
- **Severity**: **Low**
- **STRIDE Category**: Information Disclosure
- **Target**: `apps/web/components/dashboard/widgets/ErrorCardWidget.tsx` (lines 31–34)
- **Description**:  
  `ErrorCardWidget` attempts to scrub file paths from error messages:
  ```typescript
  const safeMessage = rawMessage
    .replace(/(?:\/[a-zA-Z0-9_.-]+)+/g, '[path]')
    .slice(0, 200);
  ```
  This regex matches only POSIX paths beginning with a forward slash (`/`). It fails to match Windows file paths (e.g. `C:\Users\username\Work\file.xlsx`), which contain drive letters and backslashes. Consequently, error messages on Windows systems display the full local path and username.
- **Vulnerability Impact**: Information disclosure of local system usernames and workspace paths in error UI cards.
- **Actionable Recommendation**:
  Update the sanitizer to match both Windows drive paths and UNC paths:
  ```typescript
  const safeMessage = rawMessage
    .replace(/[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g, '[path]')
    .replace(/(?:\/[a-zA-Z0-9_.-]+)+/g, '[path]')
    .slice(0, 200);
  ```

---

### [SEC-P3-12] Missing `Strict-Transport-Security` (HSTS) Header in Security Configuration
- **Severity**: **Low**
- **STRIDE Category**: Information Disclosure / Man-in-the-Middle
- **Target**: `apps/web/next.config.mjs` (lines 2–23)
- **Description**:  
  Mitigation 7 of `docs/THREAT_MODEL.md` explicitly lists:
  `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  This header is completely missing from `securityHeaders` in `next.config.mjs`.
- **Vulnerability Impact**: Absence of browser-enforced HTTPS upgrade policy; risk of SSL stripping on initial connection.
- **Actionable Recommendation**:
  Add the HSTS header to `securityHeaders` in `apps/web/next.config.mjs`:
  ```javascript
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  ```

---

## 4. Threat Model & STRIDE Mitigations Alignment Review

| Mitigation ID | Threat Model Mitigation Mandate | Phase 3 Audit Finding & Compliance Status |
|---|---|---|
| **Mitigation 1** | Ingestion Caps & Zip-Bomb Defense (10MB raw, 200MB uncompressed, 200k rows, 200 cols) | **NON-COMPLIANT (DoS)**: In-memory query engine crashes via call stack exhaustion on sheets nearing 200k rows (**SEC-P3-02**). Ingestion parser caps remain enforced. |
| **Mitigation 3** | Formula Sandbox & Zero Runtime Execution | **COMPLIANT**: Formulas are never evaluated by DuckDB or in-memory engine. Cached values only. |
| **Mitigation 4** | Prototype Pollution Defense (SafeIdentifier, Forbidden Keys) | **PARTIALLY COMPLIANT**: Column keys enforce `SafeIdentifierSchema`. Pivot table matrix totals use unconstrained objects susceptible to prototype pollution (**SEC-P3-08**). |
| **Mitigation 5** | Formula Injection Neutralization in Export / Display Paths | **NON-COMPLIANT**: Table cells in `TableWidget` and `AccessibleDataTable` do not neutralize leading formula trigger characters, enabling clipboard CSV injection (**SEC-P3-07**). |
| **Mitigation 6** | XSS Neutralization & Zero `dangerouslySetInnerHTML` | **COMPLIANT**: Zero occurrences of `dangerouslySetInnerHTML`. All cell and widget titles render as escaped text nodes. |
| **Mitigation 7** | Strict CSP & Security Headers (`default-src 'self'`, `frame-ancestors 'none'`, HSTS) | **NON-COMPLIANT**: CSP contains `'unsafe-inline'`, lacks `frame-ancestors 'none'`, and security headers omit HSTS (**SEC-P3-01**, **SEC-P3-12**). |
| **Mitigation 8** | Prompt Injection & Data Privacy (Capped samples, zero raw row egress) | **COMPLIANT**: No LLM calls or raw data egress in Phase 3 components. |
| **Mitigation 9** | DuckDB-WASM Sandbox, AST Query Validation, Single SELECT | **NON-COMPLIANT**: DuckDB query strings are validated with flawed regexes instead of an AST validator (**SEC-P3-03**). Singleton connection suffers from concurrency lockups (**SEC-P3-04**). |
| **Mitigation 10** | Client-Side Data Isolation / Zero Server Persistence | **COMPLIANT**: All processing occurs strictly in volatile client memory. Zero analytics or server endpoints. |
| **Mitigation 14** | Supply Chain Integrity & Self-Hosted Binaries | **NON-COMPLIANT**: DuckDB-WASM bundles fetched dynamically from public `cdn.jsdelivr.net` rather than pinned self-hosted assets (**SEC-P3-06**). |

---

## 5. Verification & Testing Procedures Review

1. **CSP & Security Headers**: Verified in `apps/web/test/config.test.ts`. Existing tests assert presence of `Content-Security-Policy` and `X-Frame-Options: DENY`, but do NOT assert the absence of `'unsafe-inline'`, the presence of `frame-ancestors 'none'`, or `Strict-Transport-Security`.
2. **DuckDB Integration Tests**: `apps/web/test/query/duckdb.test.ts` tests `arrowTableToQueryResult` and BigInt conversions, but skips live in-browser execution due to Happy-DOM Node environment guards. Concurrency and timeout resilience are currently untested.
3. **Query Engine Unit & Property Tests**: `packages/engine/test/query/sql.test.ts` and `validation.test.ts` thoroughly test basic compilation, but `sql.test.ts` explicitly filters out SQL keywords from arbitrary property inputs (`filter((s) => !['drop', 'create', ...].includes(s))`), masking false positives.
4. **Dashboard & Accessibility Tests**: `apps/web/test/renderer.test.tsx` and `widgets.test.tsx` verify WCAG semantic markup and zero `dangerouslySetInnerHTML`.

---

## 6. Audit Conclusion & Remediation Roadmap

The Phase 3 deliverables establish an impressive architecture for responsive, accessible in-browser dashboard visualization. However, production readiness is blocked by critical security vulnerabilities in CSP configuration, call stack exhaustion at scale, regex SQL validation flaws, and DuckDB concurrency issues.

### Mandatory Remediation Priority:
1. **Immediate P0**: Remove `'unsafe-inline'` from CSP and add `frame-ancestors 'none'` and HSTS in `apps/web/next.config.mjs` (**SEC-P3-01**, **SEC-P3-12**).
2. **Immediate P0**: Replace `Math.min(...numValues)` and `Math.max(...numValues)` with linear iterative loops in `packages/engine/src/query/memory.ts` (**SEC-P3-02**).
3. **High P1**: Replace blacklist regex in `SafeSqlQuerySchema` with lexical token filtering / AST allowlisting, eliminating false positives on legitimate business data (**SEC-P3-03**).
4. **High P1**: Serialize DuckDB-WASM query execution with an async queue and recycle connections on timeout (**SEC-P3-04**).
5. **High P1**: Self-host DuckDB-WASM binaries locally to eliminate the third-party `cdn.jsdelivr.net` dependency (**SEC-P3-06**).
6. **High P1**: Enforce the 50-widget ceiling in `DashboardRenderer` fallback spec handling (**SEC-P3-05**).
7. **Medium P2**: Sanitize formula triggers in `formatDisplayValue` (**SEC-P3-07**) and use `Map` for totals in `PivotTableWidget` (**SEC-P3-08**).
