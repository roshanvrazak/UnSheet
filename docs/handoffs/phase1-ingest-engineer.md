# Phase 1 Ingest Engineer Handoff Note

**Agent:** `ingest-engineer`  
**Branch:** `agent/ingest/phase1-parse-normalise`  
**Owned Paths:**
- `packages/engine/src/parse/**`
- `packages/engine/src/normalise/**`
- `packages/engine/test/**`
- `packages/engine/package.json`  
**Status:** Completed & 100% Green (`pnpm verify` passing, 95.82% line / 92.59% branch coverage)

---

## 1. Executive Summary

Phase 1 Ingestion, Parsing, and Normalisation engine for Unsheet is complete and verified. The engine provides pure TypeScript spreadsheet ingestion running safely in Web Workers and Node.js with zero DOM dependencies. It implements rigorous defenses against decompression bombs (zip bombs), macro execution, prototype pollution, hostile formula execution, and corrupted files.

All output structures strictly conform to authoritative `@unsheet/contracts` (`WorkbookModelSchema`, `SheetModelSchema`, `SafeIdentifierSchema`). SheetJS (`xlsx`) has been installed strictly from the vendor tarball (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) without relying on the public npm registry.

Comprehensive unit tests, adversarial security tests, and `fast-check` property tests have been created in `packages/engine/test/`, achieving **95.82% line coverage** and **92.59% branch coverage** across parse and normalise modules.

---

## 2. Architecture & Components

```
packages/engine/
├── package.json                   # Pinned SheetJS vendor tarball + fast-check
├── vitest.config.ts               # Test and v8 coverage configuration
├── src/
│   ├── index.ts                   # Engine entry point and ingestWorkbook orchestrator
│   ├── parse/
│   │   ├── errors.ts              # Domain error hierarchy with machine-readable codes
│   │   ├── guards.ts              # Upload file size, magic bytes, macro & text guards
│   │   ├── zip.ts                 # Pure TS ZIP archive inspector & zip bomb defense
│   │   ├── sheetjs.ts             # Hardened SheetJS wrapper (cached values, bounds checks)
│   │   ├── hash.ts                # SHA-256 digest utility (Web Worker & Node compatible)
│   │   └── index.ts               # Parse API exports and parseWorkbook entrypoint
│   └── normalise/
│       ├── merge.ts               # Forward-fill top-left values across merged cells
│       ├── header.ts              # Density heuristics & type transition header detection
│       ├── sanitise.ts            # SafeIdentifier conversion & prototype pollution defense
│       ├── noise.ts               # Empty spacer, subtotal, and footnote row stripping
│       ├── cell.ts                # JSON-safe cell value normalisation
│       ├── sheet.ts               # SheetModel normalisation orchestrator
│       ├── workbook.ts            # WorkbookModel normalisation orchestrator
│       └── index.ts               # Normalise API exports
└── test/
    ├── parse/
    │   ├── guards.test.ts         # Unit tests for upload guards and format validation
    │   ├── zip.test.ts            # Security tests for ZIP bombs, ratios, and macros
    │   └── sheetjs.test.ts        # Unit tests for SheetJS bounds and cached values
    ├── normalise/
    │   ├── merge.test.ts          # Merge forward-fill tests
    │   ├── header.test.ts         # Header row detection heuristic tests
    │   ├── sanitise.test.ts       # Column key sanitisation & duplicate disambiguation
    │   ├── noise.test.ts          # Noise removal (spacers, subtotals, footnotes)
    │   └── pipeline.test.ts       # SheetModel & WorkbookModel contract integration tests
    ├── security/
    │   └── security.test.ts       # Prototype pollution, hostile formulas, and fail-closed tests
    ├── property/
    │   └── property.test.ts       # fast-check arbitrary grid invariants & idempotency
    └── unit_coverage.test.ts      # Targeted edge-case coverage suite
```

---

## 3. Security Invariants & Defense-in-Depth

| Threat ID | Threat Category | Attack Vector | Technical Control Enforced in `@unsheet/engine` |
|---|---|---|---|
| **THREAT-01** | Denial of Service | Zip bomb / decompression memory exhaustion | File size <= 10MB (`MAX_FILE_SIZE_BYTES`); pre-decompression ZIP inspection enforcing total uncompressed size <= 200MB (`MAX_UNCOMPRESSED_BYTES`) and compression ratio <= 100:1; workbook sheets <= 20 (`MAX_SHEETS`); rows <= 200,000 (`MAX_ROWS`); cols <= 200 (`MAX_COLUMNS`). Fails closed before decompression. |
| **THREAT-02** | DoS / XXE | Billion laughs entity expansion | SheetJS configured with `cellFormula: false`, `cellHTML: false`, `cellText: false`, and external DTD/entity expansion disabled. |
| **THREAT-03** | Tampering / Code Exec | Hostile formulas (`=cmd|...`, `=HYPERLINK`, `=1+1`) | Zero runtime formula evaluation. Pure cached calculation results (`cell.v`) are read; formula definitions (`cell.f`) are ignored. |
| **THREAT-04** | Prototype Pollution | Dangerous keys (`__proto__`, `constructor`, `prototype`) | Intercepted in `sanitiseHeaderToken` and safely prefixed (`safe___proto__`, `safe_constructor`); dynamic rows built using `Object.create(null)` and validated via `SafeIdentifierSchema`. |
| **THREAT-M1** | Macro Execution | Executable macros (`.xlsm`, `.xlsb`, `vbaProject.bin`) | Filename extensions rejected (`.xlsm`, `.xlsb`, `.xltm`, `.xlam`); ZIP inspection rejects archives containing `vbaProject.bin`, `vbaProjectSignature.bin`, or macro streams. |
| **THREAT-M2** | Format Tampering | Non-spreadsheet binaries disguised as CSV | Magic bytes and probe check validates text CSV/TSV, rejecting null bytes `0x00` and binary executables (ELF, PE, PDF, PNG, GIF). |

---

## 4. Verification & Test Metrics

### Test Suite Execution
- **Monorepo Tests:** 18 test files, 302 tests passing (100% green).
- **Engine Tests:** 12 test files, 87 tests passing (100% green).
- **Property-Based Testing:** `fast-check` verified across 100 iterations per property:
  - Normaliser never crashes on arbitrary 2D grid inputs.
  - Column keys are always pairwise unique and satisfy `SafeIdentifierSchema`.
  - Row count never increases during normalisation.
  - Header detection is idempotent on tabular data grids.

### Test Coverage (`v8` provider)
```
 % Coverage report from v8
--------------|---------|----------|---------|---------|-------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Target Requirement
--------------|---------|----------|---------|---------|-------------------
All files     |   95.82 |    92.59 |     100 |   95.82 | Lines >=90%, Branch >=85%
 normalise    |   99.51 |    94.73 |     100 |   99.51 | (Exceeds target)
  cell.ts     |     100 |      100 |     100 |     100 | 
  header.ts   |     100 |    98.46 |     100 |     100 | 
  index.ts    |     100 |      100 |     100 |     100 | 
  merge.ts    |     100 |    93.75 |     100 |     100 | 
  noise.ts    |     100 |    94.44 |     100 |     100 | 
  sanitise.ts |   96.22 |    96.55 |     100 |   96.22 | 
  sheet.ts    |     100 |    71.42 |     100 |     100 | 
  workbook.ts |     100 |    83.33 |     100 |     100 | 
 parse        |   92.56 |    89.94 |     100 |   92.56 | (Exceeds target)
  errors.ts   |     100 |      100 |     100 |     100 | 
  guards.ts   |   96.12 |    96.05 |     100 |   96.12 | 
  hash.ts     |     100 |      100 |     100 |     100 | 
  index.ts    |     100 |       60 |     100 |     100 | 
  sheetjs.ts  |   91.58 |     87.5 |     100 |   91.58 | 
  zip.ts      |   86.87 |    82.35 |     100 |   86.87 | 
--------------|---------|----------|---------|---------|-------------------
```

### Full Verification Script (`pnpm verify`)
- **Step 1/6 (Linting):** ESLint + security plugin passed cleanly (0 errors).
- **Step 2/6 (Typechecking):** Strict `tsc --noEmit` across all workspaces passed.
- **Step 3/6 (Automated Tests):** Vitest workspace tests passed (302/302).
- **Step 4/6 (Workspace Build):** Workspace build passed.
- **Step 5/6 (Secret Scanning):** Zero secrets detected.
- **Step 6/6 (Dependency Audit):** Audit passed with zero high/critical vulnerabilities.

---

## 5. Downstream Integration & Handoff

The `WorkbookModel` output produced by `ingestWorkbook` or `normaliseWorkbook` is ready for direct consumption by Phase 2 engineers:
1. **Profiling Engineer (`packages/engine/src/profile/**`):** Can ingest `WorkbookModel.sheets[*]` directly to compute statistical distributions, type inferences, semantic roles, and capped sample values (max 5 items, max 40 chars).
2. **Web Worker Integration (`apps/web`):** The engine executes cleanly inside browser Web Workers and Node with zero DOM access.
