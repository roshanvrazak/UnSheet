# Phase 1 Fixtures Engineer Handoff Note

**Agent:** `fixtures-engineer`  
**Branch:** `agent/fixtures/phase1-messy-corpus`  
**Owned Paths:** `packages/fixtures/**`  
**Status:** Completed & 100% Green  

---

## 1. Executive Summary

Phase 1 Synthetic & Messy Fixture Corpus implementation is complete. A total of **28 distinct spreadsheet workbooks** (26 `.xlsx` workbooks and 2 `.csv` files) and their accompanying **28 Golden Normalized JSON Baselines** have been programmatically generated, verified against `@unsheet/contracts`, committed to `packages/fixtures/files/` and `packages/fixtures/src/golden/`, and tested via Vitest with 148 automated test assertions passing 100% green.

All data is 100% synthetic and invented. The corpus covers standard spreadsheets, edge cases, pathological layouts, extreme scale boundaries, international character sets, security vectors, and 3 rich domain-specific operational spreadsheets.

---

## 2. Inventory of Workbooks & Golden Baselines

| # | Fixture ID | Filename | Format | Category | Invariant & Edge Case Focus |
|---|---|---|---|---|---|
| 01 | `01_clean_baseline` | `01_clean_baseline.xlsx` | xlsx | Baseline | Single sheet, headers on row 1, well-typed employee rows, zero noise. |
| 02 | `02_header_offset` | `02_header_offset.xlsx` | xlsx | Structure | Title and metadata banner on rows 1-3; table headers located on row 4 (`detectedRowIndex: 3`). |
| 03 | `03_multi_row_merged_headers` | `03_multi_row_merged_headers.xlsx` | xlsx | Structure | Two-tier merged headers (e.g. `Location` -> `Country`/`City`, `Q1 Figures` -> `Target`/`Actual`/`Variance`) forward-filled into composite keys. |
| 04 | `04_subtotal_grand_total` | `04_subtotal_grand_total.xlsx` | xlsx | Structure | Interleaved department subtotals and bottom grand total stripped from normalized rows. |
| 05 | `05_blank_spacer_rows_columns` | `05_blank_spacer_rows_columns.xlsx` | xlsx | Structure | Arbitrary blank rows and empty spacer columns (col A, col D) pruned by normaliser. |
| 06 | `06_footnotes_trailing_notes` | `06_footnotes_trailing_notes.xlsx` | xlsx | Structure | Trailing asterisks, compliance footnotes, and signoff blocks below data table stripped. |
| 07 | `07_mixed_data_types` | `07_mixed_data_types.xlsx` | xlsx | Types | Numbers, string status codes, booleans, and thresholds mixed in same column; safely typed as `text`. |
| 08 | `08_excel_serial_dates_1900` | `08_excel_serial_dates_1900.xlsx` | xlsx | Dates | Windows Excel 1900 date system numeric serials (e.g. 45200 -> `2023-10-01`) normalized to ISO 8601. |
| 09 | `09_excel_serial_dates_1904` | `09_excel_serial_dates_1904.xlsx` | xlsx | Dates | Mac Excel 1904 date system (`wb.properties.date1904 = true`, 1462-day shift) converted to ISO dates. |
| 10 | `10_multi_format_date_strings` | `10_multi_format_date_strings.xlsx` | xlsx | Dates | ISO (`2024-01-15`), US (`02/20/2024`), UK (`25/03/2024`), named (`15-Apr-2024`), dotted formats normalized to ISO 8601. |
| 11 | `11_currency_financial_formats` | `11_currency_financial_formats.xlsx` | xlsx | Numbers | International currencies (`$`, `€`, `£`) and accounting negative parentheses `(1,250.00)` parsed as negative floats. |
| 12 | `12_percentage_formats` | `12_percentage_formats.xlsx` | xlsx | Numbers | Formatted percentages (`15.5%`, `0.025`, `(5.2%)`) normalized to decimal proportions. |
| 13 | `13_hidden_sheets_and_columns` | `13_hidden_sheets_and_columns.xlsx` | xlsx | Metadata | Hidden PII/salary columns (`hidden: true`) and a completely hidden secondary payroll worksheet (`state: 'hidden'`). |
| 14 | `14_duplicate_header_names` | `14_duplicate_header_names.xlsx` | xlsx | Structure | Multiple duplicate labels (`Status`, `Target`) disambiguated with sequential suffixes (`status`, `status_1`, `status_2`). |
| 15 | `15_multisheet_join_keys` | `15_multisheet_join_keys.xlsx` | xlsx | Structure | Relational 3-sheet schema (`customers` -> `orders` -> `order_items`) linked by explicit foreign keys. |
| 16 | `16_wide_extreme` | `16_wide_extreme.xlsx` | xlsx | Extreme | Wide table stress test containing **160 columns** (`channel_001` through `channel_158`). |
| 17 | `17_tall_extreme` | `17_tall_extreme.xlsx` | xlsx | Extreme | Tall table stress test containing **10,005 rows** of synthetic financial transactions. |
| 18 | `18_unicode_rtl_headers` | `18_unicode_rtl_headers.xlsx` | xlsx | International | Arabic (RTL), Hebrew (RTL), Chinese, Russian, accented characters, and emoji sanitized to safe ASCII identifiers. |
| 19 | `19_formula_cached_values` | `19_formula_cached_values.xlsx` | xlsx | Formulas | Formulas with pre-calculated cached evaluation results read directly without formula execution. |
| 20 | `20_formula_no_cached_values` | `20_formula_no_cached_values.xlsx` | xlsx | Formulas | Uncalculated formulas without cached values handled cleanly as `null` without throwing. |
| 21 | `21_merged_data_cells` | `21_merged_data_cells.xlsx` | xlsx | Structure | Vertically merged grouped categorical cells forward-filled to preserve tabular integrity. |
| 22 | `22_csv_delimiters` | `22_csv_delimiters.csv` | csv | Delimiters | European semicolon-delimited (`;`) text format parsed into clean tabular records. |
| 23 | `23_csv_multiline` | `23_csv_multiline.csv` | csv | Delimiters | RFC 4180 CSV with multiline quoted cells containing embedded raw newlines (`\n`). |
| 24 | `24_whitespace_messy` | `24_whitespace_messy.xlsx` | xlsx | Structure | Untrimmed leading/trailing spaces and tabs in headers and values cleanly stripped during normalization. |
| 25 | `25_hostile_formulas` | `25_hostile_formulas.xlsx` | xlsx | Hostile | Hostile formula injection strings (`=cmd`, `@SUM`, `+HYPERLINK`, `-1+1`, `\t=calc`, `\n=1`, `\|dir`) treated as literal text. |
| 26 | `26_domain_project_pipeline` | `26_domain_project_pipeline.xlsx` | xlsx | Domain | Capital engineering project pipeline with stages, budgets, commitments, spend, schedules, and health flags (25 projects). |
| 27 | `27_domain_boq_quotes` | `27_domain_boq_quotes.xlsx` | xlsx | Domain | Procurement Bill of Quantities (BOQ) with construction trade sections, quantities, unit rates, and vendor assignments (30 items). |
| 28 | `28_domain_supplier_lead_times` | `28_domain_supplier_lead_times.xlsx` | xlsx | Domain | Supply chain logistics delivery log tracking promised vs. actual lead days and on-time performance flags (35 shipments). |

---

## 3. Architecture & Generator Pipeline

### Directory Structure
```
packages/fixtures/
├── files/                       # Pre-generated binary workbooks (.xlsx, .csv)
│   ├── 01_clean_baseline.xlsx
│   ├── ...
│   └── 28_domain_supplier_lead_times.xlsx
├── src/
│   ├── golden/                  # 28 Golden Normalized JSON baseline files
│   │   ├── 01_clean_baseline.golden.json
│   │   ├── ...
│   │   └── 28_domain_supplier_lead_times.golden.json
│   ├── generators/
│   │   ├── utils.ts             # SafeIdentifier sanitization, epoch conversions, styling
│   │   ├── baseline.ts          # Generators 01 - 06
│   │   ├── types.ts             # Generators 07 - 12
│   │   ├── structural.ts        # Generators 13 - 18
│   │   ├── advanced.ts          # Generators 19 - 25
│   │   ├── domains.ts           # Generators 26 - 28
│   │   └── index.ts             # Registry of all 28 generator functions and metadata
│   ├── generate.ts              # Batch generation script emitting files/ and golden/
│   ├── index.ts                 # Public loader API, metadata, and golden baseline access
│   └── types.ts                 # GoldenBaseline, GeneratedFixture, and FixtureMeta types
├── test/
│   └── fixtures.test.ts         # Vitest test suite (148 tests)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Safety & Identifier Sanitization (`packages/fixtures/src/generators/utils.ts`)
- Sanitizes raw header strings into strictly valid `SafeIdentifier` strings conforming to `@unsheet/contracts`.
- Strips punctuation, replaces spaces with underscores, normalizes leading digits with `col_`, and enforces lowercase ASCII.
- Explicitly guards against prototype pollution vectors (`__proto__`, `constructor`, `prototype`), prepending `col_`.
- Disambiguates duplicate headers deterministically with sequential suffixes (`status`, `status_1`, `status_2`).

### Date Epoch Conversion Rules
- **1900 Date System:** Serial 1 is `1900-01-01`. Includes Lotus 1-2-3 fictitious leap year day (Feb 29, 1900). Offset is calculated relative to `1899-12-31`.
- **1904 Date System:** Serial 0 is `1904-01-01`. Offset is calculated relative to `1904-01-01` (1462-day shift from 1900 epoch).

---

## 4. Loader API & Golden Data Access

Consuming packages (such as `@unsheet/engine` and `@unsheet/web`) can import the loader API directly:

```typescript
import {
  getFixtureBuffer,      // (idOrNumber: string | number) => Promise<Buffer>
  getFixtureFilePath,    // (idOrNumber: string | number) => string
  getFixtureGolden,      // (idOrNumber: string | number) => GoldenWorkbook
  getAllGoldenBaselines, // () => Record<string, GoldenWorkbook>
  getAllFixtureMetas,    // () => FixtureMeta[]
  getFixtureMeta,        // (idOrNumber: string | number) => FixtureMeta | undefined
  fixtureGenerators,     // Record<string, FixtureGeneratorFn>
  generateAllFixtures,   // (options?: GenerateOptions) => Promise<GeneratedFixture[]>
} from '@unsheet/fixtures';
```

- **Offline / Zero Generation Overhead:** Pre-generated workbooks and golden JSON files are committed to disk. Calling `getFixtureBuffer` or `getFixtureGolden` reads directly from disk synchronously or asynchronously without invoking `exceljs`.
- **On-Demand Fallback:** If a file is missing, `getFixtureBuffer` automatically falls back to in-memory generation via its generator function.

---

## 5. Verification & Test Results

### Commands Executed & Verified
1. **Batch Generation:**
   ```bash
   pnpm --filter @unsheet/fixtures generate
   # Output: Successfully generated all 28 fixtures in 414ms.
   ```
2. **TypeScript Compilation:**
   ```bash
   pnpm --filter @unsheet/fixtures typecheck
   # Output: Exit 0 (zero errors)
   ```
3. **Vitest Unit & Invariant Suite:**
   ```bash
   pnpm --filter @unsheet/fixtures test
   # Output: 2 passed test files, 148 passed tests in 539ms (100% green).
   ```
4. **Monorepo Suite:**
   ```bash
   pnpm test
   # Output: 17 passed test files, 284 passed tests across contracts, engine, fixtures, web.
   ```

---

## 6. Handoff Notes for `ingest-engineer`

1. **Parser & Normaliser Testing:**
   Use `getFixtureBuffer(id)` to feed the raw spreadsheet buffer into `parseSpreadsheet(...)` and assert that the resulting `WorkbookModel` matches `getFixtureGolden(id)`.
2. **Key Disambiguation:**
   Ensure the parser normalizer produces matching sanitized keys for Fixture 14 (`status`, `status_1`, `status_2`).
3. **Formula Cells (Fixtures 19 & 20):**
   In Fixture 19, cached values exist in the cell record. In Fixture 20, cached value is missing; the normalizer should yield `null` without throwing.
4. **Delimited CSVs (Fixtures 22 & 23):**
   Fixture 22 requires delimiter sniffing for `;`. Fixture 23 tests embedded newlines within quoted fields.
5. **Security (Fixture 25):**
   Formula injection characters (`=`, `+`, `-`, `@`, `\t`, `\n`, `|`) must not trigger code execution or formula evaluation.
