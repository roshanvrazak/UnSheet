import { describe, it, expect } from 'vitest';
import type {
  SheetModel,
  WidgetSpec,
  QueryPlan,
  BarChartWidgetSpec,
  KPIWidgetSpec,
} from '@unsheet/contracts';
import {
  SafeSqlQuerySchema,
} from '@unsheet/contracts';
import {
  buildWidgetQueryPlan,
  compileQueryPlanToSql,
  executeQueryInMemory,
  validateQueryPlanAgainstSheet,
  quoteIdentifier,
  escapeSqlLiteral,
} from '../../src/index.js';

describe('Adversarial Red-Team Suite: Phase 3 Query Engine & Planner', () => {
  const baseSheet: SheetModel = {
    id: 'sheet_sales_adversarial',
    name: 'Sales_Data',
    headers: {
      detectedRowIndex: 0,
      confidence: 1.0,
      originalHeaders: ['Region', 'Product', 'Revenue', 'Quantity'],
      sanitizedKeys: ['region', 'product', 'revenue', 'quantity'],
    },
    columns: [
      { key: 'region', originalName: 'Region', columnIndex: 0 },
      { key: 'product', originalName: 'Product', columnIndex: 1 },
      { key: 'revenue', originalName: 'Revenue', columnIndex: 2 },
      { key: 'quantity', originalName: 'Quantity', columnIndex: 3 },
    ],
    rows: [
      { region: 'North', product: 'Software', revenue: 50000, quantity: 10 },
      { region: 'South', product: 'Hardware', revenue: 30000, quantity: 5 },
      { region: 'North', product: 'Hardware', revenue: 20000, quantity: 4 },
      { region: 'West', product: 'Software', revenue: 40000, quantity: 8 },
    ],
    rowCount: 4,
    columnCount: 4,
  };

  // =========================================================================
  // ATTACK VECTOR 1: Malformed & Pathological Query Plans & WidgetSpecs
  // =========================================================================
  describe('Vector 1: Malformed & Pathological Specs & Query Plans', () => {
    it('ADV-P3-01: Unknown / unsupported widget type in buildWidgetQueryPlan throws descriptive error', () => {
      const unsupportedWidget = {
        id: 'widget_unknown_01',
        type: 'radar',
        title: 'Radar Chart',
        grid: { x: 0, y: 0, w: 6, h: 4 },
      } as unknown as WidgetSpec;

      expect(() => buildWidgetQueryPlan(baseSheet, unsupportedWidget)).toThrow(
        /Unsupported widget type/i
      );
    });

    it('ADV-P3-02: Missing measures in bar chart spec causes undefined access and contract violation in buildBarPlan', () => {
      const malformedBar = {
        id: 'bar_no_measures',
        type: 'bar',
        title: 'Bar Without Measures',
        grid: { x: 0, y: 0, w: 6, h: 4 },
        dimension: 'region',
        measures: [], // empty measures
        aggregation: 'sum',
      } as unknown as BarChartWidgetSpec;

      // orderBy accesses measures[0]! which is undefined, failing QueryPlanSchema
      expect(() => buildWidgetQueryPlan(baseSheet, malformedBar)).toThrow();
    });

    it('ADV-P3-03: Prototype pollution keys (__proto__, constructor, prototype) in activeFilters are safely ignored', () => {
      const kpiWidget: KPIWidgetSpec = {
        id: 'kpi_revenue',
        type: 'kpi',
        title: 'Total Revenue',
        grid: { x: 0, y: 0, w: 4, h: 3 },
        measure: 'revenue',
        aggregation: 'sum',
      };

      const hostileFilters = {
        __proto__: { polluted: true },
        constructor: 'exploit',
        prototype: 123,
      };

      const plan = buildWidgetQueryPlan(baseSheet, kpiWidget, hostileFilters);
      // None of the prototype keys should make it into query plan filters
      expect(plan.filters).toBeUndefined();
    });

    it('ADV-P3-04: Limit and offset boundary violations in validateQueryPlanAgainstSheet', () => {
      const planNegativeOffset: QueryPlan = {
        id: 'plan_neg_offset',
        table: 'Sales_Data',
        select: ['revenue'],
        offset: -10,
      };
      const res1 = validateQueryPlanAgainstSheet(planNegativeOffset, baseSheet);
      expect(res1.valid).toBe(false);
      expect(res1.errors.some((e) => e.includes('Offset must be a non-negative integer'))).toBe(true);

      const planExcessiveLimit: QueryPlan = {
        id: 'plan_huge_limit',
        table: 'Sales_Data',
        select: ['revenue'],
        limit: 100000,
      };
      const res2 = validateQueryPlanAgainstSheet(planExcessiveLimit, baseSheet);
      expect(res2.valid).toBe(false);
      expect(res2.errors.some((e) => e.includes('Limit must be a positive integer and <= 50000'))).toBe(true);
    });
  });

  // =========================================================================
  // ATTACK VECTOR 2: SQL Injection & Sanitization in compileQueryPlanToSql
  // =========================================================================
  describe('Vector 2: SQL Injection & Sanitization in compileQueryPlanToSql', () => {
    it('ADV-P3-05: Malicious column and table names with quotes, semicolons, and comments are rejected by quoteIdentifier', () => {
      const hostileIdentifiers = [
        'col"; DROP TABLE users; --',
        'col\' OR \'1\'=\'1',
        'tbl` WHERE 1=1',
        'col/*comment*/',
        'admin"--',
      ];

      for (const ident of hostileIdentifiers) {
        expect(() => quoteIdentifier(ident)).toThrow();
      }
    });

    it('ADV-P3-06: SQL Injection attempt via unvalidated orderBy[].direction in compileQueryPlanToSql', () => {
      const injectionPlan = {
        id: 'plan_sqli_order',
        table: 'Sales_Data',
        select: ['revenue'],
        orderBy: [
          {
            columnKey: 'revenue',
            direction: 'ASC, (SELECT count(*) FROM secret_table) ASC',
          },
        ],
      } as unknown as QueryPlan;

      const compiledSql = compileQueryPlanToSql(injectionPlan);
      // Direction is strictly validated/formatted to ASC or DESC, neutralizing injection
      expect(compiledSql).not.toContain('SECRET_TABLE');
      expect(compiledSql).toContain('ORDER BY "revenue" ASC');
    });

    it('ADV-P3-07: Hostile filter values with single quotes and comments are safely escaped by escapeSqlLiteral', () => {
      const injectionStrings = [
        "admin' --",
        "x' UNION SELECT * FROM passwords --",
        "'; DROP TABLE Sales_Data; --",
        "' OR '1'='1",
      ];

      for (const payload of injectionStrings) {
        const escaped = escapeSqlLiteral(payload);
        // Single quotes must be doubled and wrapped
        expect(escaped.startsWith("'")).toBe(true);
        expect(escaped.endsWith("'")).toBe(true);
        // Verify internal single quotes were doubled
        const inner = escaped.slice(1, -1);
        expect(inner.replace(/''/g, '')).not.toContain("'");
      }
    });

    it('ADV-P3-08: Forbidden SQL administrative keywords as table/column names are rejected', () => {
      const forbiddenKeywords = [
        'DROP',
        'INSERT',
        'UPDATE',
        'DELETE',
        'ALTER',
        'CREATE',
        'COPY',
        'ATTACH',
        'DETACH',
        'INSTALL',
        'LOAD',
        'PRAGMA',
      ];

      for (const kw of forbiddenKeywords) {
        const forbiddenPlan: QueryPlan = {
          id: `plan_${kw.toLowerCase()}`,
          table: kw,
          select: ['revenue'],
        };
        const validation = validateQueryPlanAgainstSheet(forbiddenPlan, baseSheet);
        expect(validation.valid).toBe(false);
        expect(validation.errors.some((e) => e.includes('matches forbidden SQL keyword'))).toBe(true);
      }
    });

    it('ADV-P3-09: SafeSqlQuerySchema false positive DoS on legitimate column names matching forbidden keywords', () => {
      // If a spreadsheet column is legitimately named "copy" or "create":
      const validQueryWithCopyColumn = 'SELECT "copy" FROM "Sales_Data"';

      // SafeSqlQuerySchema uses maskSqlLiteralsAndIdentifiers so quoted identifiers matching keywords do NOT false-positive throw
      const parsed = SafeSqlQuerySchema.parse(validQueryWithCopyColumn);
      expect(parsed).toBe(validQueryWithCopyColumn);
    });

    it('ADV-P3-10: SQL LIKE wildcard characters (%, _) and trailing backslash are unescaped in contains/starts_with/ends_with', () => {
      const filterWithWildcards = {
        columnKey: 'product',
        operator: 'contains' as const,
        value: '100%_guaranteed\\',
      };

      const plan: QueryPlan = {
        id: 'plan_like_wildcard',
        table: 'Sales_Data',
        select: ['product'],
        filters: [filterWithWildcards],
      };

      const sql = compileQueryPlanToSql(plan);
      // Wildcards are escaped and ESCAPE '\\' clause is appended
      expect(sql).toContain("LIKE '%100\\%\\_guaranteed\\\\%' ESCAPE '\\'");
    });
  });

  // =========================================================================
  // ATTACK VECTOR 3: Memory Engine Edge Cases & DoS
  // =========================================================================
  describe('Vector 3: In-Memory Engine Edge Cases & DoS Risks', () => {
    it('ADV-P3-11: Call Stack Overflow crash in computeAggregation min/max on large datasets (> 120,000 items)', () => {
      // The contract allows MAX_ROWS = 200,000.
      // computeAggregation uses Math.min(...numValues) and Math.max(...numValues).
      // When numValues exceeds ~120,000, spreading into function parameters throws RangeError: Maximum call stack size exceeded.
      const largeRowCount = 150000;
      const largeRows = new Array(largeRowCount).fill(null).map(() => ({
        revenue: 10,
      }));

      const largeSheet: SheetModel = {
        id: 'sheet_large_dos',
        name: 'Large_Sheet',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: ['Revenue'],
          sanitizedKeys: ['revenue'],
        },
        columns: [{ key: 'revenue', originalName: 'Revenue', columnIndex: 0 }],
        rows: largeRows,
        rowCount: largeRowCount,
        columnCount: 1,
      };

      const minPlan: QueryPlan = {
        id: 'plan_min_overflow',
        table: 'Large_Sheet',
        aggregations: [{ columnKey: 'revenue', function: 'min', alias: 'min_rev' }],
      };

      // Spreading 150,000 arguments into Math.min is prevented by iterative loop; query succeeds
      const result = executeQueryInMemory(minPlan, largeSheet);
      expect(result.rows[0]?.['min_rev']).toBe(10);
    });

    it('ADV-P3-12: Object.create(null) in grid cells triggers unhandled TypeError in matchesFilter and sorting', () => {
      const nullProtoObj = Object.create(null);
      nullProtoObj.key = 'hostile';

      const hostileCellSheet: SheetModel = {
        ...baseSheet,
        rows: [
          { region: nullProtoObj, product: 'Software', revenue: 50000, quantity: 10 },
          { region: 'South', product: 'Hardware', revenue: 30000, quantity: 5 },
        ],
      };

      const filterPlan: QueryPlan = {
        id: 'plan_null_proto_filter',
        table: 'Sales_Data',
        select: ['region'],
        filters: [{ columnKey: 'region', operator: 'contains', value: 'north' }],
      };

      // safeToString handles Object.create(null) safely without throwing TypeError
      const result = executeQueryInMemory(filterPlan, hostileCellSheet);
      expect(result).toBeDefined();
    });

    it('ADV-P3-13: distinctCount aggregation on BigInt or circular objects throws unhandled TypeError in JSON.stringify', () => {
      const circularObj: Record<string, unknown> = { name: 'test' };
      circularObj.self = circularObj;

      const circularSheet: SheetModel = {
        ...baseSheet,
        rows: [
          { region: circularObj, product: 'Software', revenue: 50000, quantity: 10 },
        ],
      };

      const distinctPlan: QueryPlan = {
        id: 'plan_distinct_circular',
        table: 'Sales_Data',
        aggregations: [{ columnKey: 'region', function: 'distinctCount', alias: 'dist_reg' }],
      };

      // computeAggregation distinctCount calls JSON.stringify(v) which throws on circular structure
      expect(() => executeQueryInMemory(distinctPlan, circularSheet)).toThrow(
        /Converting circular structure to JSON/i
      );
    });

    it('ADV-P3-14: Empty sheets (0 rows) and sheets with all nulls execute without crashing', () => {
      const emptySheet: SheetModel = {
        ...baseSheet,
        rows: [],
        rowCount: 0,
      };

      const kpiPlan: QueryPlan = {
        id: 'plan_empty_kpi',
        table: 'Sales_Data',
        aggregations: [{ columnKey: 'revenue', function: 'sum', alias: 'total_rev' }],
      };

      const resEmpty = executeQueryInMemory(kpiPlan, emptySheet);
      expect(resEmpty.rowCount).toBe(1);
      expect(resEmpty.rows[0]?.total_rev).toBeNull();

      const allNullSheet: SheetModel = {
        ...baseSheet,
        rows: [
          { region: null, product: null, revenue: null, quantity: null },
          { region: null, product: null, revenue: null, quantity: null },
        ],
        rowCount: 2,
      };

      const resNull = executeQueryInMemory(kpiPlan, allNullSheet);
      expect(resNull.rowCount).toBe(1);
      expect(resNull.rows[0]?.total_rev).toBeNull();
    });
  });

  // =========================================================================
  // ATTACK VECTOR 4: Schema Drift & Stale Filter Handling
  // =========================================================================
  describe('Vector 4: Schema Drift & Stale Filter Handling', () => {
    it('ADV-P3-15: Unrecognized / stale filter keys in activeFilters are NOT filtered out by resolveMergedFilters and cause query validation failure', () => {
      const widget: KPIWidgetSpec = {
        id: 'kpi_revenue',
        type: 'kpi',
        title: 'Total Revenue',
        grid: { x: 0, y: 0, w: 4, h: 3 },
        measure: 'revenue',
        aggregation: 'sum',
      };

      // User has a stale filter in URL or filter state for a deleted column
      const staleFilters = {
        deleted_column: 'electronics',
      };

      const plan = buildWidgetQueryPlan(baseSheet, widget, staleFilters);

      // Stale / unrecognized filter key is successfully dropped by normalizeFilterEntry
      expect(plan.filters).toBeUndefined();
      const result = executeQueryInMemory(plan, baseSheet);
      expect(result).toBeDefined();
    });

    it('ADV-P3-16: Missing columns referenced in widgets (schema drift) are rejected by validateQueryPlanAgainstSheet', () => {
      const driftPlan: QueryPlan = {
        id: 'plan_drift',
        table: 'Sales_Data',
        aggregations: [{ columnKey: 'non_existent_measure', function: 'sum', alias: 'total' }],
      };

      const validation = validateQueryPlanAgainstSheet(driftPlan, baseSheet);
      expect(validation.valid).toBe(false);
      expect(
        validation.errors.some((e) =>
          e.includes('Aggregation column "non_existent_measure" is not allowlisted')
        )
      ).toBe(true);
    });
  });
});
