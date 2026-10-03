import { describe, expect, it } from 'vitest';
import { getAllGoldenBaselines, getFixtureGolden } from '@unsheet/fixtures';
import { inferColumnType, findJoinCandidates } from '../../src/index.js';

describe('Profiling Engine Accuracy Benchmarks', () => {
  it('achieves >= 95% column type inference accuracy across all 28 fixtures', () => {
    const goldens = getAllGoldenBaselines();
    let totalColumns = 0;
    let correctColumns = 0;
    const mismatches: Array<{ fixture: string; colKey: string; expected: string; got: string }> = [];

    for (const [fixtureId, golden] of Object.entries(goldens)) {
      for (const sheet of golden.sheets) {
        for (const [colKey, expectedType] of Object.entries(sheet.inferredTypes)) {
          totalColumns++;
          const origHeaderIdx = sheet.headers.sanitizedKeys.indexOf(colKey);
          const origHeader =
            origHeaderIdx >= 0 ? sheet.headers.originalHeaders[origHeaderIdx] : colKey;

          const values = sheet.rows.map((r) => r[colKey]);
          const result = inferColumnType(values, {
            key: colKey,
            originalName: origHeader,
          });

          if (result.inferredType === expectedType) {
            correctColumns++;
          } else {
            mismatches.push({
              fixture: fixtureId,
              colKey,
              expected: expectedType,
              got: result.inferredType,
            });
          }
        }
      }
    }

    const accuracy = correctColumns / totalColumns;
    expect(totalColumns).toBeGreaterThanOrEqual(300);
    expect(mismatches).toEqual([]);
    expect(accuracy).toBeGreaterThanOrEqual(0.95);
    expect(accuracy).toBe(1.0); // 100% exact match
  });

  it('correctly infers 1900 serial dates (fixture 08) as date with confidence >= 0.90', () => {
    const golden08 = getFixtureGolden('08_excel_serial_dates_1900');
    const sheet = golden08.sheets[0]!;

    const targetSerialVals = sheet.rows.map((r) => r.target_serial);
    const resultTarget = inferColumnType(targetSerialVals, {
      key: 'target_serial',
      originalName: 'Target Serial',
    });
    expect(resultTarget.inferredType).toBe('date');
    expect(resultTarget.confidence).toBeGreaterThanOrEqual(0.9);

    const plannedDateVals = sheet.rows.map((r) => r.planned_date);
    const resultPlanned = inferColumnType(plannedDateVals, {
      key: 'planned_date',
      originalName: 'Planned Date',
    });
    expect(resultPlanned.inferredType).toBe('date');
    expect(resultPlanned.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('correctly infers 1904 serial dates (fixture 09) as date with confidence >= 0.90', () => {
    const golden09 = getFixtureGolden('09_excel_serial_dates_1904');
    const sheet = golden09.sheets[0]!;

    const execSerialVals = sheet.rows.map((r) => r.execution_serial);
    const resultExec = inferColumnType(execSerialVals, {
      key: 'execution_serial',
      originalName: 'Execution Serial',
    });
    expect(resultExec.inferredType).toBe('date');
    expect(resultExec.confidence).toBeGreaterThanOrEqual(0.9);

    const formattedDateVals = sheet.rows.map((r) => r.formatted_date);
    const resultFormatted = inferColumnType(formattedDateVals, {
      key: 'formatted_date',
      originalName: 'Formatted Date',
    });
    expect(resultFormatted.inferredType).toBe('date');
    expect(resultFormatted.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('correctly infers currency formats (fixture 11) as currency with confidence >= 0.90', () => {
    const golden11 = getFixtureGolden('11_currency_financial_formats');
    const sheet = golden11.sheets[0]!;

    const currencyCols = ['usd_gross', 'eur_expense', 'gbp_margin', 'net_position'];
    for (const colKey of currencyCols) {
      const origHeaderIdx = sheet.headers.sanitizedKeys.indexOf(colKey);
      const origHeader = sheet.headers.originalHeaders[origHeaderIdx]!;
      const vals = sheet.rows.map((r) => r[colKey]);

      const result = inferColumnType(vals, {
        key: colKey,
        originalName: origHeader,
      });

      expect(result.inferredType).toBe('currency');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.currencyCode).toBeDefined();
    }
  });

  it('correctly infers percentage formats (fixture 12) as percent with confidence >= 0.90', () => {
    const golden12 = getFixtureGolden('12_percentage_formats');
    const sheet = golden12.sheets[0]!;

    const percentCols = ['click_through_pct', 'conversion_pct', 'yoy_growth', 'discount_rate'];
    for (const colKey of percentCols) {
      const origHeaderIdx = sheet.headers.sanitizedKeys.indexOf(colKey);
      const origHeader = sheet.headers.originalHeaders[origHeaderIdx]!;
      const vals = sheet.rows.map((r) => r[colKey]);

      const result = inferColumnType(vals, {
        key: colKey,
        originalName: origHeader,
      });

      expect(result.inferredType).toBe('percent');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('detects multi-sheet foreign key relationships in fixture 15', () => {
    const golden15 = getFixtureGolden('15_multisheet_join_keys');

    // Convert golden sheets to SheetModel format for join detection
    const sheets = golden15.sheets.map((s, idx) => ({
      id: `s_${idx}`,
      name: s.sheetName,
      headers: {
        detectedRowIndex: s.headers.detectedRowIndex,
        confidence: s.headers.confidence,
        originalHeaders: s.headers.originalHeaders,
        sanitizedKeys: s.headers.sanitizedKeys,
      },
      columns: s.headers.sanitizedKeys.map((k, cIdx) => ({
        key: k,
        originalName: s.headers.originalHeaders[cIdx] || k,
        columnIndex: cIdx,
      })),
      rows: s.rows,
      rowCount: s.rowCount,
      columnCount: s.columnCount,
    }));

    const joins = findJoinCandidates(sheets);
    expect(joins.length).toBeGreaterThanOrEqual(2);

    const customerJoin = joins.find(
      (j) =>
        (j.fromSheet === 'customers' && j.toSheet === 'orders' && j.fromColumn === 'customer_id') ||
        (j.fromSheet === 'orders' && j.toSheet === 'customers' && j.fromColumn === 'customer_id')
    );
    expect(customerJoin).toBeDefined();
    expect(customerJoin!.overlapRatio).toBeGreaterThan(0.5);

    const orderJoin = joins.find(
      (j) =>
        (j.fromSheet === 'orders' && j.toSheet === 'order_items' && j.fromColumn === 'order_id') ||
        (j.fromSheet === 'order_items' && j.toSheet === 'orders' && j.fromColumn === 'order_id')
    );
    expect(orderJoin).toBeDefined();
    expect(orderJoin!.overlapRatio).toBeGreaterThan(0.5);
  });
});
