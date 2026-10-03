# Task Brief: Phase 1 - Synthetic & Messy Fixture Corpus

## Agent
`fixtures-engineer`

## Goal
Generate a comprehensive synthetic workbook corpus (25+ Excel `.xlsx` and `.csv` files) using `exceljs`, covering all typical spreadsheet messiness and edge cases, plus 3 complete domain demo workbooks. Provide golden normalized data representations for testing the parser and normaliser.

## Owned Paths
- `packages/fixtures/**`

## Required Workbooks (25+ Total, 100% Invented Data)
1. **Clean Baseline**: Single sheet, clean headers on row 1, well-typed rows.
2. **Header Offset (Row 4)**: Title and metadata in rows 1-3, actual column headers on row 4.
3. **Multi-Row Merged Headers**: Category headers spanning multiple subheaders (e.g. Q1 -> Jan, Feb, Mar).
4. **Subtotal & Grand Total Rows**: Summary rows interleaved and at bottom ("Total", "Subtotal", "Average").
5. **Blank Spacer Rows & Columns**: Arbitrary empty rows and columns scattered throughout table.
6. **Footnotes & Trailing Notes**: Comments and asterisks below data table ("* Notes: subject to audit").
7. **Mixed Data Types**: Numbers, strings, and dates mixed within the exact same column.
8. **Excel Serial Dates (1900 System)**: Numeric dates under 1900 date system (e.g. 45200).
9. **Excel Serial Dates (1904 System)**: Mac Excel 1904 date system offsets.
10. **Date Strings in Multiple Formats**: ISO (YYYY-MM-DD), US (MM/DD/YYYY), UK (DD/MM/YYYY), named months ("15-Jan-2024").
11. **Currency & Financial Formats**: Formatted with `$`, `€`, `£`, `¥`, accounting parentheses for negative numbers `(1,250.00)`.
12. **Percentage Formats**: Formatted with `%` and raw decimal proportions.
13. **Hidden Sheets & Columns**: Sheets and columns flagged as hidden in workbook XML metadata.
14. **Duplicate Header Names**: Multiple columns with identical labels (e.g. "Status", "Date", "Total").
15. **Multi-Sheet with Join Keys**: 2-3 sheets linked by foreign keys (e.g., `customers.customer_id` <-> `orders.customer_id`).
16. **Wide Extreme**: 150+ columns.
17. **Tall Extreme**: 10,000+ rows.
18. **Unicode & RTL Headers**: Non-ASCII, Arabic, Hebrew, Chinese, accented characters, emoji.
19. **Formula Cells with Cached Values**: Calculated formulas where cached evaluation is present in cell record.
20. **Formula Cells without Cached Values**: Formula present but cached value is null/empty.
21. **Merged Data Cells**: Merged cells in data rows representing grouped values.
22. **CSV with Semicolon / Tab Delimiters**: Non-comma delimited text files.
23. **CSV with Multiline Quoted Cells**: Cells containing raw newlines inside quotes.
24. **Leading/Trailing Whitespace in Headers and Values**: Messy untrimmed cells.
25. **Hostile Cell Contents**: Formula injection strings (`=cmd`, `@SUM`, `+HYPERLINK`, `-1+1`, `\t=calc`, `\n=1`).
26. **Domain Demo 1: Project Pipeline**: Projects, stages, budgets, owners, start/end dates, completion %.
27. **Domain Demo 2: BOQ & Quotes**: Bill of quantities, item codes, descriptions, units, quantities, unit rates, totals.
28. **Domain Demo 3: Supplier Lead Times**: Suppliers, components, order dates, promised dates, actual delivery, lead time days, status.

## Specifications
- Write generator script in `packages/fixtures/src/generate.ts` and export generated buffers / file paths.
- Generate `.xlsx` files programmatically using `exceljs` (add as devDependency in `packages/fixtures/package.json`).
- Ensure all workbook data is completely synthetic / invented.
- Emit golden normalized JSON baselines for each fixture in `packages/fixtures/src/golden/`.
- Export a fixture loader API from `packages/fixtures/src/index.ts`.
- Add Vitest tests in `packages/fixtures/test/fixtures.test.ts` verifying all 25+ fixtures load properly.

## Acceptance Criteria
- 25+ distinct, valid spreadsheet buffers / files generated and committed or reproducible via generator.
- Golden files define the expected normalized table output (`headers`, `rows`, `inferredTypes`).
- `pnpm --filter @unsheet/fixtures test` passes with 100% green.
- Handoff note written at `docs/handoffs/phase1-fixtures-engineer.md`.
