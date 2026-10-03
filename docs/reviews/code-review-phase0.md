# Independent Code Review: Phase 0 Deliverables

**Date**: 2026-10-04  
**Auditor**: Independent Code Reviewer (`code-reviewer`)  
**Target Workspaces & Deliverables**:
- `packages/contracts/src/**` ([contracts/src](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src))
- `packages/contracts/test/**` ([contracts/test](file:///home/rvr/Work/basi/UnSheet/packages/contracts/test))
- Root configs: [`package.json`](file:///home/rvr/Work/basi/UnSheet/package.json), [`pnpm-workspace.yaml`](file:///home/rvr/Work/basi/UnSheet/pnpm-workspace.yaml), [`tsconfig.base.json`](file:///home/rvr/Work/basi/UnSheet/tsconfig.base.json), [`tsconfig.json`](file:///home/rvr/Work/basi/UnSheet/tsconfig.json)
- Package configs: [`packages/contracts/package.json`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/package.json), [`packages/contracts/tsconfig.json`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/tsconfig.json)
- Test configs: [`vitest.config.ts`](file:///home/rvr/Work/basi/UnSheet/vitest.config.ts), [`vitest.workspace.ts`](file:///home/rvr/Work/basi/UnSheet/vitest.workspace.ts)
- Specifications: [`docs/SPEC.md`](file:///home/rvr/Work/basi/UnSheet/docs/SPEC.md), [`docs/ARCHITECTURE.md`](file:///home/rvr/Work/basi/UnSheet/docs/ARCHITECTURE.md)

---

## 1. Executive Summary & Audit Verdict

### Overall Verdict: **CONDITIONAL PASS** (Remediations Required Before Phase 1 Ingestion Integration)

The Phase 0 deliverables establish a robust, modern, and mathematically sound foundational contract layer for Unsheet. The contract architecture rigorously enforces domain boundaries, privacy constraints (capped samples, prototype pollution defense), and type safety across all 6 core dashboard widgets, schema drift detection, query execution plans, and API communication.

However, the audit identified **1 High-severity verification pipeline blocker**, **4 High-severity contract/config flaws**, and **6 Medium-severity structural gaps** that must be resolved before proceeding into Phase 1 engine implementation. Most critically, the verification script [`scripts/verify.sh`](file:///home/rvr/Work/basi/UnSheet/scripts/verify.sh) currently **fails** due to unused imports in the newly introduced adversarial test suite, and the contracts `tsconfig.json` excludes test files from static typechecking during `pnpm typecheck`.

### Evaluation Scorecard

| Evaluation Dimension | Rating | Summary Assessment |
|---|---|---|
| **1. TypeScript Strictness** | **A-** | Excellent base configuration (`noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`). Zero `any` in `src/`. Critical gap: `test/**` is omitted from `tsconfig.json` compilation, bypassing typecheck. |
| **2. Contract Completeness** | **A** | Complete coverage of `WorkbookModel`, `ColumnProfile`, `DashboardSpec` (discriminated union on 6 widget types), `Template`, `DriftReport`, `QueryPlan`, and API payloads. |
| **3. Test Coverage & Negative Testing** | **A-** | 54 tests passing across 3 suites with exhaustive positive/negative validation. 6 unused imports in `adversarial.test.ts` break ESLint in CI. Missing `@vitest/coverage-v8` in `devDependencies`. |
| **4. Cleanliness & Minimal Dependencies** | **A-** | Strictly zero runtime dependencies in `@unsheet/contracts` beyond `zod: ^3.24.2`. Clean source exports. Minor redundancy in Vitest workspace configs. |

---

## 2. Findings Matrix

| Finding ID | Severity | Category | Target Location | Description |
|---|---|---|---|---|
| **REV-P0-01** | **HIGH** | CI / Linting | [`packages/contracts/test/adversarial.test.ts#L11-L28`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/test/adversarial.test.ts#L11-L28) | 6 unused schema imports break ESLint (`@typescript-eslint/no-unused-vars`), causing [`scripts/verify.sh`](file:///home/rvr/Work/basi/UnSheet/scripts/verify.sh) Step 1 to fail immediately. |
| **REV-P0-02** | **HIGH** | Compiler Config | [`packages/contracts/tsconfig.json#L3`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/tsconfig.json#L3) | `"include": ["src/**/*"]` excludes `packages/contracts/test/**` from `pnpm typecheck`. Type errors in tests are silently ignored. |
| **REV-P0-03** | **HIGH** | Security / XSS | [`packages/contracts/src/api.ts#L65`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/api.ts#L65) | `CreateShareLinkResponseSchema.shareUrl` uses unconstrained `z.string().url()`, allowing dangerous pseudo-protocols (`javascript:`, `data:`). |
| **REV-P0-04** | **HIGH** | Layout Safety | [`packages/contracts/src/spec.ts#L7-L12`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/spec.ts#L7-L12) | `WidgetGridPositionSchema` does not validate `x + w <= 12`. Coordinates like `x: 11, w: 12` (spanning to col 23) pass validation, corrupting grid layouts. |
| **REV-P0-05** | **HIGH** | Data Boundary | [`packages/contracts/src/profile.ts#L50-L56`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/profile.ts#L50-L56) | `CategoryFrequencySchema.value` in `ColumnProfile.topValues` permits un-sanitized formula characters and up to 256 characters per entry without sanitization. |
| **REV-P0-06** | **MEDIUM** | Tooling / CI | [`package.json#L15-L23`](file:///home/rvr/Work/basi/UnSheet/package.json#L15-L23), [`vitest.config.ts#L8-L11`](file:///home/rvr/Work/basi/UnSheet/vitest.config.ts#L8-L11) | `@vitest/coverage-v8` declared in `vitest.config.ts` is not installed in root `devDependencies`, causing interactive terminal prompts/hangs during coverage runs. |
| **REV-P0-07** | **MEDIUM** | Project Structure | [`packages/contracts/src/index.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/index.test.ts) vs [`packages/contracts/test/**`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/test/) | Inconsistent test file placement: `src/index.test.ts` resides in `src/` while other tests reside in `test/`. |
| **REV-P0-08** | **MEDIUM** | Formula Sanitization | [`packages/contracts/src/common.ts#L26-L32`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/common.ts#L26-L32) | `SampleValueSchema` regex `/^[=+\-@\t\r]/` fails to catch leading spaces (`" =cmd"`), newlines (`"\n=1+1"`), or DDE pipe operators (`"\|cmd"`). |
| **REV-P0-09** | **MEDIUM** | Prototype Pollution | [`packages/contracts/src/spec.ts#L299`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/spec.ts#L299), [`packages/contracts/src/workbook.ts#L72`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/workbook.ts#L72), [`packages/contracts/src/template.ts#L49`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/template.ts#L49) | Entity IDs (`DashboardSpec.id`, `SheetModel.id`, `Template.id`, `sheetBinding`) use `z.string()` instead of `SafeIdentifierSchema`, allowing `__proto__` / `constructor`. |
| **REV-P0-10** | **MEDIUM** | Query Safety | [`packages/contracts/src/query.ts#L33`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/query.ts#L33) | `QueryFilterSchema.value` is defined as `z.unknown().optional()`, accepting arbitrary objects or cyclic structures rather than SQL-safe primitive literals. |
| **REV-P0-11** | **MEDIUM** | DoS / Resource Limit | [`packages/contracts/src/spec.ts#L305`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/spec.ts#L305) | `DashboardSpecSchema.widgets` has `.min(1)` but lacks a `.max()` limit, permitting thousands of widgets to exhaust memory in the renderer. |
| **REV-P0-12** | **LOW** | Config Redundancy | [`vitest.workspace.ts`](file:///home/rvr/Work/basi/UnSheet/vitest.workspace.ts) & [`vitest.config.ts#L7`](file:///home/rvr/Work/basi/UnSheet/vitest.config.ts#L7) | Redundant workspace definitions between `vitest.workspace.ts` (`defineWorkspace`) and `vitest.config.ts` (`test.projects`). |
| **REV-P0-13** | **LOW** | Data Integrity | [`packages/contracts/src/profile.ts#L35-L43`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/profile.ts#L35-L43), [`packages/contracts/src/query.ts#L94`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/query.ts#L94) | `NumericStatsSchema` and `QueryResult.executionTimeMs` accept `Infinity` and `NaN` (lack `z.number().finite()`). |
| **REV-P0-14** | **LOW** | Schema Redundancy | [`packages/contracts/src/drift.ts#L20-L30`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/drift.ts#L20-L30) | `ColumnDriftSchema` is defined and exported but unreferenced by `DriftReportSchema`, which inlines a different shape for `matchedColumns`. |
| **REV-P0-15** | **LOW** | Semantic Integrity | [`packages/contracts/src/template.ts#L24-L25`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/template.ts#L24-L25) | `SchemaFingerprintSchema` does not refine that `columnCount === columns.length`. |

---

## 3. Detailed Audit by Category

### Category 1: TypeScript Strictness & Compiler Options

#### Base Configuration ([`tsconfig.base.json`](file:///home/rvr/Work/basi/UnSheet/tsconfig.base.json))
- **Settings Inspected**:
  ```json
  "target": "ES2022",
  "module": "NodeNext",
  "moduleResolution": "NodeNext",
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "isolatedModules": true
  ```
- **Strengths**: High degree of strictness. `noUncheckedIndexedAccess` ensures array indexing yields `T | undefined` across all modules. `exactOptionalPropertyTypes` prevents assigning `undefined` to optional fields unless explicitly typed with `| undefined`.
- **Finding REV-P0-02**: [`packages/contracts/tsconfig.json`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/tsconfig.json#L3) only includes `["src/**/*"]`.
  - In `package.json`, `"typecheck": "pnpm -r exec tsc --noEmit"`.
  - Because `test/` is outside `src/`, running `pnpm typecheck` skips [`packages/contracts/test/contracts.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/test/contracts.test.ts) and [`packages/contracts/test/adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/test/adversarial.test.ts).
  - *Remediation*: Update `include` in `packages/contracts/tsconfig.json` to:
    ```json
    "include": ["src/**/*", "test/**/*"]
    ```

#### Static Type Verification & Cast Audit ([`packages/contracts/src/**`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src))
- **`any` Audit**: Running static analysis across `packages/contracts/src/**` confirmed **zero instances** of `any`.
- **Type Cast Audit**: Only 1 type assertion exists in source code:
  - [`packages/contracts/src/common.ts#L17`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/common.ts#L17):
    `val as typeof FORBIDDEN_OBJECT_KEYS[number]`
    This cast is standard in TypeScript when invoking `Array.prototype.includes` with a readonly tuple constant (`FORBIDDEN_OBJECT_KEYS = ['__proto__', 'constructor', 'prototype'] as const`). It does not bypass safety.
- **Export Verification**: [`packages/contracts/src/index.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/index.ts) re-exports all 7 domain modules cleanly using standard ES module syntax with `.js` extensions compatible with NodeNext resolution.

---

### Category 2: Contract Completeness & Domain Invariants

#### 1. `WorkbookModel` ([`packages/contracts/src/workbook.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/workbook.ts))
- **Conformance**: Fully implements `CellTypeSchema`, `CellModelSchema`, `HeaderMetadataSchema`, `ColumnMetadataSchema`, `SheetBoundsSchema`, `SheetModelSchema`, `FileTypeSchema`, `WorkbookMetadataSchema`, and `WorkbookModelSchema`.
- **Invariants Verified**:
  - File types constrained to `['xlsx', 'xls', 'csv', 'tsv']`.
  - Sheet count bounded by `min(1)` and `max(50)`.
  - Row keys validated against `SafeIdentifierSchema` (`rows: z.array(z.record(SafeIdentifierSchema, z.unknown()))`).
  - Column index and row index strictly non-negative integers.
- **Gaps**:
  - `SheetModelSchema.id` and `WorkbookModelSchema.id` are generic strings (`z.string().min(1).max(64)`), which allow dangerous identifiers such as `__proto__` or `constructor` (Finding **REV-P0-09**).
  - Lack of `.max(100_000)` on `SheetModelSchema.rows` despite `SPEC.md` specifying a 100k row limit.

#### 2. `ColumnProfile` & `SheetProfile` ([`packages/contracts/src/profile.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/profile.ts))
- **Conformance**: Implements 8 inferred types (`number`, `currency`, `percent`, `date`, `category`, `id`, `boolean`, `text`) and 4 semantic roles (`dimension`, `measure`, `time`, `identifier`).
- **Invariants Verified**:
  - `sampleValues` enforced via `SampleValuesArraySchema` (capped at max 5 items, <=40 chars each, formula triggers rejected).
  - Uniqueness ratio bounded between 0 and 1.
  - Sheet profile mandates at least one column profile.
- **Gaps**:
  - `topValues` (using `CategoryFrequencySchema`) allows up to 50 items with `value: z.string().max(256)` without formula sanitization. Sending `topValues` to LLM or CSV export presents an un-sanitized injection vector (Finding **REV-P0-05**).
  - `NumericStatsSchema` accepts `Infinity` or `NaN` values due to missing `.finite()` (Finding **REV-P0-13**).

#### 3. `DashboardSpec` & Widgets ([`packages/contracts/src/spec.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/spec.ts))
- **Conformance**: Discriminated union on `type` implemented via `z.discriminatedUnion('type', [...])` across all 6 widget specs:
  1. `KPIWidgetSpecSchema` (`type: 'kpi'`)
  2. `LineChartWidgetSpecSchema` (`type: 'line'`)
  3. `BarChartWidgetSpecSchema` (`type: 'bar'`)
  4. `DonutChartWidgetSpecSchema` (`type: 'donut'`)
  5. `TableWidgetSpecSchema` (`type: 'table'`)
  6. `PivotTableWidgetSpecSchema` (`type: 'pivot'`)
- **Invariants Verified**:
  - Rejects unknown widget types at runtime.
  - Validates widget-specific rules (e.g., Donut `innerRadius` 0–0.9, Line `timeDimension` required, Bar `dimension` required, Table `pageSize` 5–100).
- **Gaps**:
  - `WidgetGridPositionSchema` checks `x` (0–11) and `w` (1–12) independently, but lacks `.refine((pos) => pos.x + pos.w <= 12)`. Coordinates like `{ x: 11, y: 0, w: 12, h: 4 }` pass validation and cause visual overflow (Finding **REV-P0-04**).
  - `DashboardSpecSchema.widgets` has no `.max()` limit, exposing the renderer to memory exhaustion attacks (Finding **REV-P0-11**).

#### 4. `Template` & `SchemaFingerprint` ([`packages/contracts/src/template.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/template.ts))
- **Conformance**: `TemplateSchema` encapsulates a `DashboardSpecSchema`, `SchemaFingerprintSchema` (with 64-char SHA-256 hex digest validation), categories, and timestamps.
- **Gaps**:
  - `SchemaFingerprintSchema` does not verify `fingerprint.columnCount === fingerprint.columns.length` (Finding **REV-P0-15**).

#### 5. `DriftReport` ([`packages/contracts/src/drift.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/drift.ts))
- **Conformance**: Models `ColumnDriftStatusSchema` (`matched`, `missing`, `type_changed`, `renamed`), `AddedColumnSchema`, `TypeMismatchSchema`, and `RemappingSuggestionSchema`.
- **Gaps**:
  - `ColumnDriftSchema` is defined in lines 20–30 but not reused inside `DriftReportSchema`, leading to duplicated shape definitions (Finding **REV-P0-14**).

#### 6. `QueryPlan` & Results ([`packages/contracts/src/query.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/query.ts))
- **Conformance**: Fully defines 14 `QueryFilterOperatorSchema` values, safe table/column identifiers, aggregations, sort orders, and pagination.
- **Gaps**:
  - `QueryFilterSchema.value` is typed as `z.unknown().optional()`. While necessary for unary filters (`is_null`), binary filters should restrict values to JSON-safe primitives (`string | number | boolean | null | Array<string | number>`) to prevent passing complex objects or functions to DuckDB query builders (Finding **REV-P0-10**).

#### 7. API Payloads ([`packages/contracts/src/api.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/api.ts))
- **Conformance**:
  - `SpecRefinementRequest`/`Response` for LLM spec editing.
  - `ShareTokenSchema` requiring minimum 22 characters URL-safe alphanumeric characters (>= 128-bit entropy).
  - `AskYourDataRequest`/`Response` for natural language querying.
- **Gaps**:
  - `CreateShareLinkResponseSchema.shareUrl` uses `z.string().url()` without protocol validation, allowing `javascript:` URLs (Finding **REV-P0-03**).

---

### Category 3: Test Coverage & Verification Pipeline

#### Test Suite Performance & Results
Running `pnpm test` executes 3 test files across `@unsheet/contracts`:
1. [`packages/contracts/src/index.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/index.test.ts): 1 test passing (export availability).
2. [`packages/contracts/test/contracts.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/test/contracts.test.ts): 24 tests passing (functional contract validation).
3. [`packages/contracts/test/adversarial.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/test/adversarial.test.ts): 29 tests passing (security boundary probing).
**Total**: 54 tests passing (0 failures).

#### Verification Pipeline Failure Analysis
Executing [`scripts/verify.sh`](file:///home/rvr/Work/basi/UnSheet/scripts/verify.sh) fails at Step 1 (`pnpm run lint`):
```
/home/rvr/Work/basi/UnSheet/packages/contracts/test/adversarial.test.ts
  11:3  error  'KPIWidgetSpecSchema' is defined but never used         @typescript-eslint/no-unused-vars
  13:3  error  'BarChartWidgetSpecSchema' is defined but never used    @typescript-eslint/no-unused-vars
  16:3  error  'PivotTableWidgetSpecSchema' is defined but never used  @typescript-eslint/no-unused-vars
  24:3  error  'WorkbookModelSchema' is defined but never used         @typescript-eslint/no-unused-vars
  26:3  error  'QueryResultSchema' is defined but never used           @typescript-eslint/no-unused-vars
  28:3  error  'AskYourDataRequestSchema' is defined but never used    @typescript-eslint/no-unused-vars
```
Because `pnpm verify` halts on ESLint errors, the automated CI pipeline is broken (Finding **REV-P0-01**).

#### Coverage Tooling Deficiency
[`vitest.config.ts#L9`](file:///home/rvr/Work/basi/UnSheet/vitest.config.ts#L9) specifies `"provider": "v8"`. However, `@vitest/coverage-v8` is not declared in root [`package.json`](file:///home/rvr/Work/basi/UnSheet/package.json). Invoking `vitest run --coverage` triggers an interactive prompt asking to install `@vitest/coverage-v8`, which hangs non-interactive CI jobs (Finding **REV-P0-06**).

---

### Category 4: Cleanliness, Dependencies & Monorepo Configuration

#### Monorepo & Dependencies
- [`packages/contracts/package.json`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/package.json):
  ```json
  "dependencies": {
    "zod": "^3.24.2"
  }
  ```
  Strictly compliant with the zero-runtime-dependency rule.
- [`pnpm-workspace.yaml`](file:///home/rvr/Work/basi/UnSheet/pnpm-workspace.yaml): Correctly defines `packages/*` and `apps/*`. Workspace dependencies use `workspace:*` in `package.json` files for packages `engine`, `fixtures`, and `web`.

#### Dead Code & Configuration Redundancy
- **Workspace Config**: Both [`vitest.config.ts`](file:///home/rvr/Work/basi/UnSheet/vitest.config.ts#L7) (`projects: ['packages/*', 'apps/*']`) and [`vitest.workspace.ts`](file:///home/rvr/Work/basi/UnSheet/vitest.workspace.ts) define identical project globs. Vitest 3 natively uses `projects` in `vitest.config.ts`.
- **Test File Organization**: [`packages/contracts/src/index.test.ts`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/index.test.ts) is in `src/`, while other test files are located in `test/`. Consolidating all tests into `test/` maintains a clean separation of production code and test suites.

---

## 4. Phase-Gate Action Plan & Recommendations

To achieve unconditional sign-off for Phase 0 before starting Phase 1, the following remediation steps should be executed:

### High-Priority Remediations (Blockers for Phase 0 Sign-Off)
1. **Fix Unused Imports in Test Suite** (Resolves **REV-P0-01**):
   Remove the 6 unused imports in [`packages/contracts/test/adversarial.test.ts#L11-L28`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/test/adversarial.test.ts#L11-L28) so `pnpm lint` and `bash scripts/verify.sh` pass cleanly.
2. **Include Test Directory in Typecheck** (Resolves **REV-P0-02**):
   Update [`packages/contracts/tsconfig.json`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/tsconfig.json):
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "include": ["src/**/*", "test/**/*"]
   }
   ```
3. **Restrict URI Scheme on Share Links** (Resolves **REV-P0-03**):
   In [`packages/contracts/src/api.ts#L65`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/api.ts#L65):
   ```ts
   shareUrl: z.string().url().refine(
     (url) => url.startsWith('https://') || url.startsWith('http://localhost'),
     { message: 'Share URL must use https:// protocol' }
   ),
   ```
4. **Enforce Horizontal Grid Boundary Constraints** (Resolves **REV-P0-04**):
   In [`packages/contracts/src/spec.ts#L7-L12`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/spec.ts#L7-L12):
   ```ts
   export const WidgetGridPositionSchema = z.object({
     x: z.number().int().min(0).max(11),
     y: z.number().int().nonnegative(),
     w: z.number().int().min(1).max(12),
     h: z.number().int().min(1).max(24),
   }).refine((pos) => pos.x + pos.w <= 12, {
     message: 'Widget position exceeds 12-column grid bounds (x + w must be <= 12)',
   });
   ```
5. **Sanitize ColumnProfile `topValues`** (Resolves **REV-P0-05**):
   Update `CategoryFrequencySchema.value` in [`packages/contracts/src/profile.ts#L50-L54`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/profile.ts#L50-L54) to apply `SampleValueSchema` or formula trigger stripping.

### Medium-Priority Remediations
6. **Install `@vitest/coverage-v8` in Root devDependencies** (Resolves **REV-P0-06**):
   Run `pnpm add -D -w @vitest/coverage-v8@^3.0.7` to prevent CI coverage hangs.
7. **Harden Formula Injection Detection** (Resolves **REV-P0-08**):
   In [`packages/contracts/src/common.ts#L26-L32`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/common.ts#L26-L32), trim input and include the pipe operator in the regex: `/^[=+\-@\t\r\|]/.test(val.trimStart())`.
8. **Enforce Max Bounds on Widget Arrays** (Resolves **REV-P0-11**):
   In [`packages/contracts/src/spec.ts#L305`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/spec.ts#L305), add `.max(50, 'Dashboard cannot exceed 50 widgets')`.
9. **Constrain Query Filter Values** (Resolves **REV-P0-10**):
   In [`packages/contracts/src/query.ts#L33`](file:///home/rvr/Work/basi/UnSheet/packages/contracts/src/query.ts#L33), replace `z.unknown().optional()` with a union of primitives:
   ```ts
   value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]).optional(),
   ```
10. **Use `SafeIdentifierSchema` for Entity Identifiers** (Resolves **REV-P0-09**):
    Replace generic `z.string().min(1).max(64)` for `DashboardSpec.id`, `SheetModel.id`, and `Template.id` with `SafeIdentifierSchema` to eliminate prototype pollution risks.
