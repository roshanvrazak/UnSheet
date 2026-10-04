# Adversarial Red-Team Security Review: Phase 3 Query Engine & Dashboard Renderer

**Date**: 2026-10-04  
**Target**:
- Query Engine: `packages/engine/src/query/**` (`validation.ts`, `planner.ts`, `sql.ts`, `memory.ts`)
- Dashboard Components: `apps/web/components/dashboard/**` (`DashboardRenderer.tsx`, `FilterBar.tsx`, `WidgetContainer.tsx`, `WidgetErrorBoundary.tsx`, `AccessibleDataTable.tsx`, `widgets/*`)
- Web Query Execution: `apps/web/lib/query/**` (`duckdb.ts`, `executor.ts`)  
**Reviewer**: Adversarial QA & Red-Team Agent  
**Status**: Completed  
**Test Suites**:
- [`packages/engine/test/adversarial/phase3_adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/phase3_adversarial.test.ts) (16 tests passing)
- [`apps/web/test/adversarial.test.tsx`](file:///home/rvr/Work/basi/UnSheet/apps/web/test/adversarial.test.tsx) (10 tests passing)

---

## 1. Executive Summary

During Phase 3 adversarial testing, we red-teamed the query planner, SQL compiler, in-memory execution engine, DuckDB-WASM integration, and React dashboard rendering components under hostile conditions, fuzzing across:
1. Malformed and pathological `WidgetSpec` inputs (unknown widget types, negative/excessive coordinates, missing measures/dimensions, prototype keys).
2. Hostile strings in cell values, column headers, and widget titles (XSS payloads, formula injection strings, null-prototype objects).
3. SQL injection attempts against `compileQueryPlanToSql` and DuckDB execution (quote injection, hostile filter values, forbidden keywords, subqueries).
4. Edge-case data distributions (0-row sheets, all-null sheets, 150,000-row sheets, and schema drift / missing columns).

### Positive Defensive Controls Confirmed:
- **Total Rendering Fault Isolation**: `DashboardRenderer` and `WidgetContainer` isolate widget failures using `WidgetErrorBoundary` and contract validation fallbacks. When an individual widget has an invalid spec or missing column, it renders `ErrorCardWidget` without crashing the dashboard or sibling widgets.
- **Identifier Quoting Rigor**: `quoteIdentifier` asserts `SafeIdentifierSchema`, which strictly rejects quotes (`"`), spaces, semicolons, comments (`--`), and backticks, preventing standard column/table SQL injection.
- **XSS Immunity in React Rendering**: All widget titles, descriptions, table cells, and companion accessible data tables render data as standard React text nodes (`document.createTextNode`), with zero `dangerouslySetInnerHTML`. XSS payloads (`<script>`, `<svg onload>`, `"><img src=x onerror>`) are safely defanged.
- **Formula Injection Neutrality**: Formula triggers (`=cmd`, `@SUM`, `+HYPERLINK`, `\t`, `\r`, `|`) are treated as literal strings and not evaluated or executed in UI components or query aggregations.

### Critical Vulnerabilities & Flaws Discovered:
 host fuzzing across the four vectors uncovered **11 vulnerabilities, contract bypasses, denial-of-service risks, and functional flaws**.

The most critical findings are:
1. **SQL Injection via Unvalidated `orderBy[].direction` in `compileQueryPlanToSql` (ADV-P3-06)**: `compileQueryPlanToSql` quotes `columnKey` but interpolates `${o.direction.toUpperCase()}` directly into the `ORDER BY` clause without enum checking. An attacker constructing an ad-hoc query plan can execute arbitrary SQL subqueries (e.g. `ASC, (SELECT count(*) FROM secrets)`), which bypasses `SafeSqlQuerySchema`.
2. **Denial of Service / Engine Crash on Datasets > 120,000 Rows (ADV-P3-11)**: `computeAggregation` in `memory.ts` uses `Math.min(...numValues)` and `Math.max(...numValues)`. When a sheet has $> 120,000$ rows (permitted by contracts `MAX_ROWS = 200_000`), spreading arguments into a function call exceeds the V8 engine call stack limit and throws an unhandled `RangeError: Maximum call stack size exceeded`.
3. **Stale Filter / Schema Drift Denial of Service (ADV-P3-15)**: `normalizeFilterEntry` accepts `allowedColKeys: Set<string>`, but never drops filter keys absent from `allowedColKeys`. Consequently, stale URL filters for deleted columns are passed to `QueryPlan.filters`, which causes `validateQueryPlanAgainstSheet` to fail and crash every widget on the dashboard.
4. **Prototype Property Collision in `PivotTableWidget` (ADV-P3-W06)**: Category values matching prototype properties (`'toString'`, `'valueOf'`, `'hasOwnProperty'`) collide with `Object.prototype` in `cTotals = {}`. Evaluating `(cTotals['toString'] ?? 0) + val` returns function source strings (e.g. `function toString() { [native code] }50`), corrupting totals and leaking JavaScript internals to the UI.
5. **Input Wipeout / State Loss in `FilterBar` Numeric Range (ADV-P3-W08)**: `FilterBar` reads `rangeVal` expecting an Array, but stores an Object `{ operator: 'between', value: [...] }`, resetting the input fields to blank on every keystroke.
6. **Legitimate Column Keyword Denial of Service (ADV-P3-09)**: `SafeSqlQuerySchema` uses a word-boundary regex `/\bCOPY\b/i` which blocks queries containing legitimate quoted column names such as `SELECT "copy" FROM "sales"`.

All findings have been codified as automated tests in [`packages/engine/test/adversarial/phase3_adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/phase3_adversarial.test.ts) and [`apps/web/test/adversarial.test.tsx`](file:///home/rvr/Work/basi/UnSheet/apps/web/test/adversarial.test.tsx).

---

## 2. Vulnerability & Findings Matrix

| ID | Attack Vector | Severity | Vulnerability Description | Status |
|---|---|---|---|---|
| **ADV-P3-06** | SQL Injection | **HIGH** | `compileQueryPlanToSql` interpolates unvalidated `orderBy[].direction`, allowing arbitrary subqueries in `ORDER BY` to bypass `SafeSqlQuerySchema` | Confirmed & Tested |
| **ADV-P3-11** | Engine Crash / DoS | **HIGH** | `Math.min(...numValues)` / `Math.max(...numValues)` in `memory.ts` causes `RangeError: Maximum call stack size exceeded` on sheets > 120,000 rows | Confirmed & Tested |
| **ADV-P3-15** | Schema Drift DoS | **HIGH** | `normalizeFilterEntry` fails to drop unknown filter keys, propagating deleted columns into queries and crashing all dashboard widgets | Confirmed & Tested |
| **ADV-P3-W06** | Prototype Collision | **MEDIUM** | `PivotTableWidget` matrix totals collide with `Object.prototype` (`toString`, `valueOf`), corrupting numeric totals into function source strings | Confirmed & Tested |
| **ADV-P3-W08** | Functional State Flaw | **MEDIUM** | `FilterBar` numeric-range filter resets input state on every keystroke due to Object vs Array mismatch in `activeFilters` | Confirmed & Tested |
| **ADV-P3-09** | DoS / False Positive | **MEDIUM** | `SafeSqlQuerySchema` regex `\b(COPY\|CREATE\|LOAD)\b` rejects legitimate quoted column names like `SELECT "copy" FROM "tbl"` | Confirmed & Tested |
| **ADV-P3-12** | Engine Crash | **MEDIUM** | `Object.create(null)` in grid cells triggers unhandled `TypeError: Cannot convert object to primitive value` in `matchesFilter` and sorting | Confirmed & Tested |
| **ADV-P3-W07** | UI Exception | **MEDIUM** | `formatDisplayValue` throws `TypeError: Cannot convert object to primitive value` on `Object.create(null)` cells, requiring error boundary catch | Confirmed & Tested |
| **ADV-P3-10** | SQL Query Flaw | **LOW** | SQL LIKE wildcards (`%`, `_`) and trailing backslashes are unescaped in `contains`, `starts_with`, `ends_with` filter operators | Confirmed & Tested |
| **ADV-P3-13** | Exception / Error | **LOW** | `distinctCount` aggregation on BigInt or circular objects throws unhandled `TypeError` in `JSON.stringify` | Confirmed & Tested |
| **ADV-P3-02** | Planner Flaw | **LOW** | Empty `measures: []` in `BarChartWidgetSpec` causes undefined array indexing in `buildBarPlan`, failing plan validation | Confirmed & Tested |

---

## 3. Deep-Dive Vulnerability & Attack Vector Analyses

### Vector 1: SQL Injection & Query Compiler Security

#### ADV-P3-06: SQL Injection via Unvalidated `orderBy[].direction` in `compileQueryPlanToSql`
- **Severity**: HIGH (CWE-89: Improper Neutralization of Special Elements used in an SQL Command)
- **Affected File**: [`packages/engine/src/query/sql.ts#L194-L198`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/query/sql.ts#L194-L198)
- **Mechanism**:
  In `sql.ts`, sorting directives are compiled with:
  ```ts
  if (plan.orderBy && plan.orderBy.length > 0) {
    const orderDirectives = plan.orderBy
      .map((o) => `${quoteIdentifier(o.columnKey)} ${o.direction.toUpperCase()}`)
      .join(', ');
    queryChunks.push(`ORDER BY ${orderDirectives}`);
  }
  ```
  While `quoteIdentifier` sanitizes `o.columnKey`, `o.direction` is interpolated directly after `.toUpperCase()`.
  If an ad-hoc query plan is passed (e.g., from an external API or custom widget) without prior `QueryPlanSchema.parse`:
  `direction: 'ASC, (SELECT count(*) FROM secret_table) ASC'` compiles into:
  ```sql
  SELECT "revenue" FROM "Sales_Data" ORDER BY "revenue" ASC, (SELECT COUNT(*) FROM SECRET_TABLE) ASC
  ```
  `SafeSqlQuerySchema` permits this query because it is a single SELECT statement without semicolons, forbidden DDL keywords, or external file functions. The subquery executes against in-memory DuckDB tables.
- **Proof of Concept**:
  Verified in test `ADV-P3-06` in [`phase3_adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/phase3_adversarial.test.ts#L143-L165).
- **Remediation**:
  Enforce strict validation in `compileQueryPlanToSql`:
  ```ts
  const dir = o.direction.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  ```

---

### Vector 2: Denial of Service & Memory Engine Crashes

#### ADV-P3-11: Call Stack Overflow in `computeAggregation` on Datasets > 120,000 Rows
- **Severity**: HIGH (CWE-674: Uncontrolled Recursion / Maximum Call Stack Size Exceeded)
- **Affected File**: [`packages/engine/src/query/memory.ts#L193-L213`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/query/memory.ts#L193-L213)
- **Mechanism**:
  `computeAggregation` calculates `min` and `max` aggregations by spreading the filtered numeric values array into `Math.min` / `Math.max`:
  ```ts
  case 'min':
    return Math.min(...numValues);
  case 'max':
    return Math.max(...numValues);
  ```
  The system contract permits workbooks with up to 200,000 rows (`MAX_ROWS = 200_000`).
  In V8 and modern JavaScript engines, spreading an array with $> 120,000$ elements into a function call exceeds the call stack argument limit and triggers an immediate unhandled `RangeError: Maximum call stack size exceeded`.
- **Proof of Concept**:
  Verified in test `ADV-P3-11` in [`phase3_adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/phase3_adversarial.test.ts#L229-L265).
- **Remediation**:
  Use `reduce` or a standard loop instead of spreading into function arguments:
  ```ts
  case 'min':
    return numValues.reduce((min, v) => (v < min ? v : min), numValues[0]!);
  case 'max':
    return numValues.reduce((max, v) => (v > max ? v : max), numValues[0]!);
  ```

---

### Vector 3: Schema Drift & Stale Filter Handling

#### ADV-P3-15: Stale / Unknown Filter Propagation Causes Full Dashboard Failure
- **Severity**: HIGH (CWE-754: Improper Check for Unusual or Exceptional Conditions)
- **Affected File**: [`packages/engine/src/query/planner.ts#L46-L107`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/query/planner.ts#L46-L107)
- **Mechanism**:
  `normalizeFilterEntry(colKeyCandidate, filterValue, allowedColKeys)` accepts `allowedColKeys: Set<string>`.
  However, it only checks `allowedColKeys` to see if stripping `filter_` matches an allowed column. It never verifies that `resolvedColKey` is actually inside `allowedColKeys`:
  ```ts
  } else if (!allowedColKeys.has(resolvedColKey)) {
    if (resolvedColKey.startsWith('filter_')) {
      const stripped = resolvedColKey.slice(7);
      if (allowedColKeys.has(stripped)) {
        resolvedColKey = stripped;
      }
    }
  }
  // resolvedColKey is never rejected if absent from allowedColKeys!
  ```
  When a user has a stale filter in URL state (e.g. `deleted_column: 'value'`), `normalizeFilterEntry` creates a filter with `columnKey: 'deleted_column'`.
  This filter is attached to every widget's `QueryPlan`.
  When `executeQueryInMemory` runs, `validateQueryPlanAgainstSheet` checks the allowlist and rejects the plan with:
  `Filter column "deleted_column" is not allowlisted in sheet columns`.
  Consequently, **every widget on the dashboard crashes and renders an error card**, taking down the entire dashboard due to a single stale filter.
- **Proof of Concept**:
  Verified in test `ADV-P3-15` in [`phase3_adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/phase3_adversarial.test.ts#L318-L349).
- **Remediation**:
  Discard filters whose target column is not in `allowedColKeys`:
  ```ts
  if (!allowedColKeys.has(resolvedColKey)) {
    return null;
  }
  ```

---

### Vector 4: Prototype Collisions & Component State Flaws

#### ADV-P3-W06: Prototype Property Collision in `PivotTableWidget`
- **Severity**: MEDIUM (CWE-1385: Missing Origin or Path Check in Insecure Object Lookup)
- **Affected File**: [`apps/web/components/dashboard/widgets/PivotTableWidget.tsx#L47-L59`](file:///home/rvr/Work/basi/UnSheet/apps/web/components/dashboard/widgets/PivotTableWidget.tsx#L47-L59)
- **Mechanism**:
  `PivotTableWidget` calculates matrix row and column totals using plain JavaScript objects `{}`:
  ```ts
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
  If a category column has values such as `'toString'` or `'valueOf'`, `cTotals['toString']` looks up `Object.prototype.toString`.
  `(cTotals['toString'] ?? 0)` evaluates to `[Function: toString]`.
  Adding `val` coerces the function to string: `function toString() { [native code] }50`.
  The UI displays this function source string in the matrix footer total cell.
- **Proof of Concept**:
  Verified in test `ADV-P3-W06` in [`apps/web/test/adversarial.test.tsx`](file:///home/rvr/Work/basi/UnSheet/apps/web/test/adversarial.test.tsx#L238-L287).
- **Remediation**:
  Use `new Map<string, number>()` or null-prototype objects (`Object.create(null)`) for totals accumulators.

---

#### ADV-P3-W08: State Loss / Input Wipeout in `FilterBar` Numeric Range Filter
- **Severity**: MEDIUM (CWE-665: Improper Initialization)
- **Affected File**: [`apps/web/components/dashboard/FilterBar.tsx#L304-L352`](file:///home/rvr/Work/basi/UnSheet/apps/web/components/dashboard/FilterBar.tsx#L304-L352)
- **Mechanism**:
  In `FilterBar.tsx`:
  Line 304 expects an array:
  ```ts
  const rangeVal = Array.isArray(currentValue) ? currentValue : [];
  ```
  However, on input change (lines 323 and 343), it emits an object:
  ```ts
  handleValueChange(filter.id, {
    operator: 'between',
    value: [min ?? -1e12, max ?? 1e12],
  });
  ```
  On the subsequent re-render, `currentValue` is `{ operator: 'between', value: [...] }`.
  `Array.isArray(currentValue)` evaluates to `false`, resetting `rangeVal` to `[]`.
  The `min` and `max` input fields immediately wipe out the user's typed value on every keystroke.
- **Proof of Concept**:
  Verified in test `ADV-P3-W08` in [`apps/web/test/adversarial.test.tsx`](file:///home/rvr/Work/basi/UnSheet/apps/web/test/adversarial.test.tsx#L332-L377).
- **Remediation**:
  Extract the range values whether `currentValue` is an array or a filter object:
  ```ts
  const rangeVal = Array.isArray(currentValue)
    ? currentValue
    : typeof currentValue === 'object' && currentValue !== null && 'value' in currentValue && Array.isArray((currentValue as any).value)
    ? (currentValue as any).value
    : [];
  ```

---

#### ADV-P3-09: `SafeSqlQuerySchema` False Positive Denial of Service on Legitimate Column Names
- **Severity**: MEDIUM (CWE-20: Improper Input Validation)
- **Affected File**: [`packages/contracts/src/query.ts#L5-L36`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/query.ts#L5-L36)
- **Mechanism**:
  `SafeSqlQuerySchema` validates queries using a regex:
  ```ts
  const FORBIDDEN_SQL_KEYWORD_REGEX =
    /\b(DROP|INSERT|UPDATE|DELETE|ALTER|CREATE|COPY|ATTACH|DETACH|INSTALL|LOAD|PRAGMA)\b/i;
  ```
  Because the regex matches case-insensitively across the entire SQL string, if a spreadsheet column is legitimately named `copy`, `create`, or `load`, a valid query such as:
  ```sql
  SELECT "copy" FROM "Sales_Data"
  ```
  is rejected by `SafeSqlQuerySchema`, blocking legitimate user dashboards.
- **Proof of Concept**:
  Verified in test `ADV-P3-09` in [`phase3_adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/phase3_adversarial.test.ts#L187-L198).
- **Remediation**:
  Strip double-quoted identifiers from the SQL string before testing against `FORBIDDEN_SQL_KEYWORD_REGEX`.

---

#### ADV-P3-12 & ADV-P3-W07: Unhandled `TypeError` on `Object.create(null)` Grid Cells
- **Severity**: MEDIUM (CWE-704: Incorrect Type Conversion or Cast)
- **Affected Files**:
  - [`packages/engine/src/query/memory.ts#L29-L140`](file:///home/rvr/Work/basi/UnSheet/packages/engine/src/query/memory.ts#L29-L140)
  - [`apps/web/lib/utils.ts#L61`](file:///home/rvr/Work/basi/UnSheet/apps/web/lib/utils.ts#L61)
- **Mechanism**:
  Calling `String(cell)` or `Number(cell)` on objects created via `Object.create(null)` throws:
  `TypeError: Cannot convert object to primitive value`.
  In `memory.ts`, `matchesFilter` calls `String(cell)` directly during string comparisons, crashing the query engine. In `apps/web/lib/utils.ts`, `formatDisplayValue` invokes `Number(value)` and `String(value)`, which throws in React components. Fortunately, `WidgetErrorBoundary` catches this exception, preventing full-page collapse.
- **Proof of Concept**:
  Verified in tests `ADV-P3-12` in [`phase3_adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/engine/test/adversarial/phase3_adversarial.test.ts#L267-L293) and `ADV-P3-W07` in [`apps/web/test/adversarial.test.tsx`](file:///home/rvr/Work/basi/UnSheet/apps/web/test/adversarial.test.tsx#L289-L327).
- **Remediation**:
  Use `safeToString(val)` from `packages/engine/src/normalise/cell.ts` across all filter matching and formatting routines.

---

## 4. Actionable Remediation Guidance

### Priority 1: High Severity Fixes
1. **Sanitize `orderBy.direction` in `compileQueryPlanToSql`**:
   Replace `${o.direction.toUpperCase()}` with a strict ternary:
   `o.direction?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'`.
2. **Replace Array Spread in `computeAggregation`**:
   Replace `Math.min(...numValues)` and `Math.max(...numValues)` with a standard `for` loop or `.reduce()` to support up to 200,000 rows without call stack overflow.
3. **Filter Out Stale Columns in `normalizeFilterEntry`**:
   Add `if (!allowedColKeys.has(resolvedColKey)) return null;` in `normalizeFilterEntry` so stale URL filter parameters are silently dropped rather than breaking the query.

### Priority 2: Medium Severity Fixes
4. **Use Maps for Pivot Totals**:
   In `PivotTableWidget.tsx`, replace `cTotals: Record<string, number> = {}` with `new Map<string, number>()` to prevent prototype method collisions with `'toString'`, `'valueOf'`, and `'hasOwnProperty'`.
5. **Fix `FilterBar` Numeric Range State**:
   Support both array and `{ operator: 'between', value: [...] }` formats in `FilterBar` to prevent resetting input fields on keystrokes.
6. **Double-Quote Stripping in `SafeSqlQuerySchema`**:
   In `SafeSqlQuerySchema`, strip double-quoted column names (`sql.replace(/"[^"]*"/g, '')`) before testing against `FORBIDDEN_SQL_KEYWORD_REGEX` to prevent false positive rejections of legitimate columns like `"copy"` or `"create"`.
7. **Safe Primitive Coercion**:
   Replace raw `String(cell)` calls with `safeToString(cell)` across `memory.ts` and `utils.ts` to prevent `TypeError` crashes on null-prototype objects.

---

## 5. Verification & Test Execution Summary

The entire suite of Phase 3 adversarial tests runs cleanly in Vitest:
- `packages/engine/test/adversarial/phase3_adversarial.test.ts`: **16 passed / 16 total**
- `apps/web/test/adversarial.test.tsx`: **10 passed / 10 total**
- Full monorepo test suite: **582 passed / 582 total across 36 test files**
