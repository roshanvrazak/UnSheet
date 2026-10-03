import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { SafeIdentifierSchema, InferredDataTypeSchema } from '@unsheet/contracts';
import {
  fixtureMetadata,
  fixtureGenerators,
  getFixtureMeta,
  getFixtureFilePath,
  getFixtureBuffer,
  getFixtureGolden,
  getAllGoldenBaselines,
  getAllFixtureMetas,
} from '../src/index.js';

describe('Fixtures Corpus Registry & Metadata', () => {
  it('contains exactly 28 defined fixtures', () => {
    expect(fixtureMetadata).toHaveLength(28);
    expect(getAllFixtureMetas()).toHaveLength(28);
  });

  it('assigns unique IDs, numbers 1-28, and filenames to all fixtures', () => {
    const ids = new Set<string>();
    const numbers = new Set<number>();
    const filenames = new Set<string>();

    for (const meta of fixtureMetadata) {
      expect(ids.has(meta.id)).toBe(false);
      expect(numbers.has(meta.number)).toBe(false);
      expect(filenames.has(meta.filename)).toBe(false);

      ids.add(meta.id);
      numbers.add(meta.number);
      filenames.add(meta.filename);

      expect(meta.number).toBeGreaterThanOrEqual(1);
      expect(meta.number).toBeLessThanOrEqual(28);
      expect(meta.description.length).toBeGreaterThan(10);
    }

    expect(ids.size).toBe(28);
    expect(numbers.size).toBe(28);
  });

  it('maps every fixture to an executable generator function', () => {
    for (const meta of fixtureMetadata) {
      const fn = fixtureGenerators[meta.id];
      expect(fn).toBeDefined();
      expect(typeof fn).toBe('function');
    }
  });

  it('retrieves fixture metadata by ID or by number', () => {
    const meta1 = getFixtureMeta('01_clean_baseline');
    expect(meta1).toBeDefined();
    expect(meta1?.number).toBe(1);

    const metaByNum = getFixtureMeta(1);
    expect(metaByNum).toEqual(meta1);

    const meta28 = getFixtureMeta('28_domain_supplier_lead_times');
    expect(meta28?.number).toBe(28);

    const nonExistent = getFixtureMeta('unknown_id');
    expect(nonExistent).toBeUndefined();
  });
});

describe('Workbook Files & Buffer Generation', () => {
  it('loads valid buffers for all 28 fixtures', async () => {
    for (const meta of fixtureMetadata) {
      const buffer = await getFixtureBuffer(meta.id);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.byteLength).toBeGreaterThan(0);

      // Verify file path on disk
      const filePath = getFixtureFilePath(meta.id);
      expect(fs.existsSync(filePath)).toBe(true);

      const diskBuffer = fs.readFileSync(filePath);
      expect(diskBuffer.byteLength).toBe(buffer.byteLength);
    }
  });

  it('loads buffers using numeric indices (1..28)', async () => {
    for (let i = 1; i <= 28; i++) {
      const buffer = await getFixtureBuffer(i);
      expect(buffer.byteLength).toBeGreaterThan(0);
    }
  });
});

describe('Golden Baselines Schema & Contracts Validation', () => {
  const allGoldens = getAllGoldenBaselines();

  it('loads all 28 golden baseline JSON files', () => {
    expect(Object.keys(allGoldens)).toHaveLength(28);
  });

  for (const meta of fixtureMetadata) {
    describe(`Golden Baseline: #${meta.number} ${meta.id}`, () => {
      const golden = allGoldens[meta.id]!;

      it('adheres to GoldenWorkbook contracts structure', () => {
        expect(golden).toBeDefined();
        expect(golden.fixtureId).toBe(meta.id);
        expect(golden.fixtureNumber).toBe(meta.number);
        expect(golden.filename).toBe(meta.filename);
        expect(golden.sheets.length).toBeGreaterThanOrEqual(1);
      });

      it('validates all sanitized keys against SafeIdentifierSchema', () => {
        for (const sheet of golden.sheets) {
          expect(sheet.headers.sanitizedKeys.length).toBeGreaterThan(0);
          for (const key of sheet.headers.sanitizedKeys) {
            const parseResult = SafeIdentifierSchema.safeParse(key);
            expect(parseResult.success, `Key '${key}' must be a valid SafeIdentifier`).toBe(true);
          }
        }
      });

      it('validates all inferred column types against InferredDataTypeSchema', () => {
        for (const sheet of golden.sheets) {
          for (const [key, type] of Object.entries(sheet.inferredTypes)) {
            const parseResult = InferredDataTypeSchema.safeParse(type);
            expect(parseResult.success, `Type '${type}' for key '${key}' must be a valid InferredDataType`).toBe(true);
          }
        }
      });

      it('verifies row count, column count, and row record integrity', () => {
        for (const sheet of golden.sheets) {
          expect(sheet.rowCount).toBe(sheet.rows.length);
          expect(sheet.columnCount).toBe(sheet.headers.sanitizedKeys.length);

          if (sheet.rows.length > 0) {
            const firstRow = sheet.rows[0]!;
            for (const key of sheet.headers.sanitizedKeys) {
              expect(key in firstRow, `Row 0 missing sanitized key '${key}'`).toBe(true);
            }
          }
        }
      });
    });
  }
});

describe('Specific Edge Case & Domain Workbook Invariants', () => {
  it('Fixture 01 (Clean Baseline): clean row 1 headers, 15 rows', () => {
    const golden = getFixtureGolden('01_clean_baseline');
    const sheet = golden.sheets[0]!;
    expect(sheet.headers.detectedRowIndex).toBe(0);
    expect(sheet.rowCount).toBe(15);
    expect(sheet.headers.sanitizedKeys).toContain('employee_id');
    expect(sheet.inferredTypes.salary).toBe('currency');
    expect(sheet.inferredTypes.is_active).toBe('boolean');
  });

  it('Fixture 02 (Header Offset): detectedRowIndex is 3 (row 4)', () => {
    const golden = getFixtureGolden('02_header_offset');
    const sheet = golden.sheets[0]!;
    expect(sheet.headers.detectedRowIndex).toBe(3);
    expect(sheet.headers.sanitizedKeys).toEqual([
      'region',
      'branch_name',
      'units_sold',
      'gross_revenue',
      'target_met',
    ]);
    expect(sheet.rowCount).toBe(12);
  });

  it('Fixture 03 (Multi-Row Merged Headers): merged category hierarchy combined', () => {
    const golden = getFixtureGolden('03_multi_row_merged_headers');
    const sheet = golden.sheets[0]!;
    expect(sheet.headers.sanitizedKeys).toContain('location_country');
    expect(sheet.headers.sanitizedKeys).toContain('q1_figures_target');
    expect(sheet.headers.sanitizedKeys).toContain('q2_figures_actual');
  });

  it('Fixture 04 (Subtotal & Grand Total Rows): summary rows stripped from data rows', () => {
    const golden = getFixtureGolden('04_subtotal_grand_total');
    const sheet = golden.sheets[0]!;
    expect(sheet.rowCount).toBe(8);
    for (const r of sheet.rows) {
      const dept = String(r.department);
      expect(dept.toLowerCase()).not.toContain('total');
      expect(dept.toLowerCase()).not.toContain('subtotal');
    }
  });

  it('Fixture 05 (Blank Spacer Rows & Columns): empty spacer rows and cols pruned', () => {
    const golden = getFixtureGolden('05_blank_spacer_rows_columns');
    const sheet = golden.sheets[0]!;
    expect(sheet.columnCount).toBe(5);
    expect(sheet.rowCount).toBe(6);
    expect(sheet.headers.sanitizedKeys).not.toContain('');
  });

  it('Fixture 06 (Footnotes & Trailing Notes): trailing footnote rows excluded', () => {
    const golden = getFixtureGolden('06_footnotes_trailing_notes');
    const sheet = golden.sheets[0]!;
    expect(sheet.rowCount).toBe(7);
    expect(sheet.metadata?.notes?.length).toBeGreaterThan(0);
    for (const r of sheet.rows) {
      expect(String(r.audit_id).startsWith('AUD-')).toBe(true);
    }
  });

  it('Fixture 07 (Mixed Data Types): mixed column correctly inferred as text', () => {
    const golden = getFixtureGolden('07_mixed_data_types');
    const sheet = golden.sheets[0]!;
    expect(sheet.inferredTypes.reading_value).toBe('text');
  });

  it('Fixture 08 (Excel Serial Dates 1900): serial 45200 normalized to 2023-10-01', () => {
    const golden = getFixtureGolden('08_excel_serial_dates_1900');
    const sheet = golden.sheets[0]!;
    expect(sheet.inferredTypes.target_serial).toBe('date');
    expect(sheet.rows[0]?.target_serial).toBe('2023-10-01');
  });

  it('Fixture 09 (Excel Serial Dates 1904): 1904 system epoch correctly applied', () => {
    const golden = getFixtureGolden('09_excel_serial_dates_1904');
    const sheet = golden.sheets[0]!;
    expect(sheet.metadata?.dateSystem).toBe('1904');
    expect(sheet.rows[0]?.execution_serial).toBe('2023-10-01');
  });

  it('Fixture 10 (Multi-Format Date Strings): heterogeneous date strings normalized to ISO', () => {
    const golden = getFixtureGolden('10_multi_format_date_strings');
    const sheet = golden.sheets[0]!;
    expect(sheet.inferredTypes.raw_date_string).toBe('date');
    expect(sheet.rows[0]?.expected_iso).toBe('2024-01-15');
    expect(sheet.rows[1]?.expected_iso).toBe('2024-02-20');
    expect(sheet.rows[2]?.expected_iso).toBe('2024-03-25');
  });

  it('Fixture 11 (Currency & Financial Formats): currency parsed with negative accounting values', () => {
    const golden = getFixtureGolden('11_currency_financial_formats');
    const sheet = golden.sheets[0]!;
    expect(sheet.inferredTypes.usd_gross).toBe('currency');
    expect(sheet.inferredTypes.eur_expense).toBe('currency');
    const row2 = sheet.rows[1]!;
    expect(row2.eur_expense).toBe(-45000.75);
  });

  it('Fixture 12 (Percentage Formats): percentages stored as decimal proportions', () => {
    const golden = getFixtureGolden('12_percentage_formats');
    const sheet = golden.sheets[0]!;
    expect(sheet.inferredTypes.click_through_pct).toBe('percent');
    expect(sheet.rows[0]?.click_through_pct).toBe(0.045);
    expect(sheet.rows[0]?.yoy_growth).toBe(0.155);
  });

  it('Fixture 13 (Hidden Sheets and Columns): tracks hidden columns and hidden sheets', () => {
    const golden = getFixtureGolden('13_hidden_sheets_and_columns');
    expect(golden.sheets).toHaveLength(2);
    const visibleSheet = golden.sheets[0]!;
    expect(visibleSheet.metadata?.hiddenColumns).toContain('national_id');
    expect(visibleSheet.metadata?.hiddenColumns).toContain('base_salary');

    const hiddenSheet = golden.sheets[1]!;
    expect(hiddenSheet.metadata?.hiddenSheet).toBe(true);
  });

  it('Fixture 14 (Duplicate Header Names): disambiguates duplicate headers with _1, _2', () => {
    const golden = getFixtureGolden('14_duplicate_header_names');
    const sheet = golden.sheets[0]!;
    expect(sheet.headers.sanitizedKeys).toContain('status');
    expect(sheet.headers.sanitizedKeys).toContain('status_1');
    expect(sheet.headers.sanitizedKeys).toContain('status_2');
    expect(sheet.headers.sanitizedKeys).toContain('target');
    expect(sheet.headers.sanitizedKeys).toContain('target_1');
  });

  it('Fixture 15 (Multi-Sheet Foreign Join Keys): links customers -> orders -> order_items', () => {
    const golden = getFixtureGolden('15_multisheet_join_keys');
    expect(golden.sheets).toHaveLength(3);
    const orders = golden.sheets.find((s) => s.sheetName === 'orders')!;
    expect(orders.metadata?.foreignKeys?.[0]?.targetSheet).toBe('customers');
    expect(orders.metadata?.foreignKeys?.[0]?.targetColumn).toBe('customer_id');

    const items = golden.sheets.find((s) => s.sheetName === 'order_items')!;
    expect(items.metadata?.foreignKeys?.[0]?.targetSheet).toBe('orders');
    expect(items.metadata?.foreignKeys?.[0]?.targetColumn).toBe('order_id');
  });

  it('Fixture 16 (Wide Extreme): 160 columns', () => {
    const golden = getFixtureGolden('16_wide_extreme');
    const sheet = golden.sheets[0]!;
    expect(sheet.columnCount).toBe(160);
    expect(sheet.headers.sanitizedKeys).toHaveLength(160);
    expect(sheet.headers.sanitizedKeys[159]).toBe('channel_158');
  });

  it('Fixture 17 (Tall Extreme): 10,005 rows', () => {
    const golden = getFixtureGolden('17_tall_extreme');
    const sheet = golden.sheets[0]!;
    expect(sheet.rowCount).toBe(10005);
    expect(sheet.rows).toHaveLength(10005);
  });

  it('Fixture 18 (Unicode & RTL Headers): sanitized to valid ASCII identifiers', () => {
    const golden = getFixtureGolden('18_unicode_rtl_headers');
    const sheet = golden.sheets[0]!;
    for (const key of sheet.headers.sanitizedKeys) {
      expect(SafeIdentifierSchema.safeParse(key).success).toBe(true);
      expect(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)).toBe(true);
    }
  });

  it('Fixture 19 (Formula Cached Values): cached values preserved', () => {
    const golden = getFixtureGolden('19_formula_cached_values');
    const sheet = golden.sheets[0]!;
    expect(sheet.rows[0]?.subtotal).toBe(500.0);
    expect(sheet.rows[0]?.grand_total).toBe(540.0);
  });

  it('Fixture 20 (Formula Without Cached Values): handles uncalculated formulas as null', () => {
    const golden = getFixtureGolden('20_formula_no_cached_values');
    const sheet = golden.sheets[0]!;
    expect(sheet.rows[0]?.total_estimated_cost).toBeNull();
  });

  it('Fixture 21 (Merged Data Cells): forward fills merged category values', () => {
    const golden = getFixtureGolden('21_merged_data_cells');
    const sheet = golden.sheets[0]!;
    expect(sheet.rows[0]?.region).toBe('North America');
    expect(sheet.rows[1]?.region).toBe('North America');
    expect(sheet.rows[2]?.region).toBe('North America');
    expect(sheet.rows[3]?.region).toBe('Europe');
    expect(sheet.rows[4]?.region).toBe('Europe');
  });

  it('Fixture 22 (CSV Semicolon Delimiters): semicolon delimited format', () => {
    const golden = getFixtureGolden('22_csv_delimiters');
    expect(golden.format).toBe('csv');
    const sheet = golden.sheets[0]!;
    expect(sheet.metadata?.delimiter).toBe(';');
    expect(sheet.rowCount).toBe(5);
  });

  it('Fixture 23 (CSV Multiline Quoted Cells): multi-line cell values preserved', () => {
    const golden = getFixtureGolden('23_csv_multiline');
    expect(golden.format).toBe('csv');
    const sheet = golden.sheets[0]!;
    const log = String(sheet.rows[0]?.error_log);
    expect(log).toContain('\n');
    expect(log).toContain('Out of memory');
  });

  it('Fixture 24 (Whitespace Messy): whitespace trimmed in normalized output', () => {
    const golden = getFixtureGolden('24_whitespace_messy');
    const sheet = golden.sheets[0]!;
    expect(sheet.headers.sanitizedKeys[0]).toBe('product_sku');
    expect(sheet.rows[0]?.product_sku).toBe('SKU-091');
    expect(sheet.rows[0]?.product_description).toBe('High-Torque Servomotor');
  });

  it('Fixture 25 (Hostile Formula Strings): formula triggers treated as literal strings', () => {
    const golden = getFixtureGolden('25_hostile_formulas');
    const sheet = golden.sheets[0]!;
    expect(sheet.inferredTypes.feedback_text).toBe('text');
    expect(sheet.rows[0]?.feedback_text).toBe("=cmd|' /C calc'!A0");
    expect(sheet.rows[1]?.feedback_text).toBe('@SUM(1, 999)');
  });

  it('Fixture 26 (Domain Demo 1: Project Pipeline): 25 capital projects', () => {
    const golden = getFixtureGolden('26_domain_project_pipeline');
    const sheet = golden.sheets[0]!;
    expect(sheet.rowCount).toBe(25);
    expect(sheet.inferredTypes.approved_budget).toBe('currency');
    expect(sheet.inferredTypes.completion_pct).toBe('percent');
    expect(sheet.inferredTypes.start_date).toBe('date');
  });

  it('Fixture 27 (Domain Demo 2: BOQ & Quotes): 30 bill of quantities items', () => {
    const golden = getFixtureGolden('27_domain_boq_quotes');
    const sheet = golden.sheets[0]!;
    expect(sheet.rowCount).toBe(30);
    expect(sheet.inferredTypes.total_cost_usd).toBe('currency');
    expect(sheet.inferredTypes.tender_qty).toBe('number');
  });

  it('Fixture 28 (Domain Demo 3: Supplier Lead Times): 35 logistics shipments', () => {
    const golden = getFixtureGolden('28_domain_supplier_lead_times');
    const sheet = golden.sheets[0]!;
    expect(sheet.rowCount).toBe(35);
    expect(sheet.inferredTypes.promised_date).toBe('date');
    expect(sheet.inferredTypes.actual_lead_days).toBe('number');
    expect(sheet.inferredTypes.on_time_flag).toBe('boolean');
  });
});
