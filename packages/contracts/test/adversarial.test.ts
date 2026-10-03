import { describe, it, expect } from 'vitest';
import {
  SafeIdentifierSchema,
  SampleValueSchema,
  SampleValuesArraySchema,
  TitleSchema,
  DescriptionSchema,
  DashboardSpecSchema,
  WidgetSpecSchema,
  WidgetGridPositionSchema,
  LineChartWidgetSpecSchema,
  DonutChartWidgetSpecSchema,
  TableWidgetSpecSchema,
  DashboardLayoutSchema,
  ShareTokenSchema,
  CreateShareLinkRequestSchema,
  CreateShareLinkResponseSchema,
  ColumnProfileSchema,
  CategoryFrequencySchema,
  NumericStatsSchema,
  SheetModelSchema,
  WorkbookModelSchema,
  QueryPlanSchema,
  QueryResultSchema,
  SpecRefinementRequestSchema,
  type DashboardSpec,
} from '../src/index.js';

describe('Adversarial Red-Team Tests: Phase 0 Contracts', () => {
  const minimalValidSpec: DashboardSpec = {
    version: '1.0',
    id: 'dash_valid_01',
    title: 'Valid Dashboard',
    sheetBinding: 'sheet_main',
    layout: { columns: 12, gap: 16, padding: 16 },
    filters: [],
    widgets: [
      {
        id: 'kpi_valid',
        type: 'kpi',
        title: 'KPI Metric',
        grid: { x: 0, y: 0, w: 4, h: 2 },
        measure: 'revenue',
        aggregation: 'sum',
      },
    ],
  };

  // =========================================================================
  // 1. Prototype Pollution Keys in Identifiers and Column Names
  // =========================================================================
  describe('1. Prototype Pollution Vectors', () => {
    it('rejects prototype pollution keys in SafeIdentifierSchema', () => {
      expect(() => SafeIdentifierSchema.parse('__proto__')).toThrow();
      expect(() => SafeIdentifierSchema.parse('constructor')).toThrow();
      expect(() => SafeIdentifierSchema.parse('prototype')).toThrow();
    });

    it('rejects prototype pollution keys in SheetModel rows via SafeIdentifier record keys', () => {
      // JSON.parse creates own property __proto__
      const maliciousRowProto = JSON.parse('{"__proto__": 12345}');
      expect(() =>
        SheetModelSchema.parse({
          id: 'sheet_01',
          name: 'Sheet 1',
          headers: {
            detectedRowIndex: 0,
            confidence: 1.0,
            originalHeaders: ['col1'],
            sanitizedKeys: ['col1'],
          },
          columns: [{ key: 'col1', originalName: 'col1', columnIndex: 0 }],
          rows: [maliciousRowProto],
          rowCount: 1,
          columnCount: 1,
        })
      ).toThrow();

      const maliciousRowConstructor = JSON.parse('{"constructor": 12345}');
      expect(() =>
        SheetModelSchema.parse({
          id: 'sheet_01',
          name: 'Sheet 1',
          headers: {
            detectedRowIndex: 0,
            confidence: 1.0,
            originalHeaders: ['col1'],
            sanitizedKeys: ['col1'],
          },
          columns: [{ key: 'col1', originalName: 'col1', columnIndex: 0 }],
          rows: [maliciousRowConstructor],
          rowCount: 1,
          columnCount: 1,
        })
      ).toThrow();
    });

    it('rejects prototype pollution keys in CreateShareLinkRequest dataSnapshot', () => {
      const maliciousSnapshot = [JSON.parse('{"__proto__": "polluted"}')];
      expect(() =>
        CreateShareLinkRequestSchema.parse({
          title: 'Shared Dash',
          spec: minimalValidSpec,
          includeDataSnapshot: true,
          dataSnapshot: maliciousSnapshot,
        })
      ).toThrow();
    });

    it('exposes prototype pollution acceptance in entity IDs not governed by SafeIdentifierSchema', () => {
      // DashboardSpec.id uses z.string().min(1).max(64), NOT SafeIdentifierSchema
      // This exposes that __proto__ and constructor can be stored as dashboard IDs
      const specWithProtoId = {
        ...minimalValidSpec,
        id: '__proto__',
      };
      const parsed = DashboardSpecSchema.parse(specWithProtoId);
      expect(parsed.id).toBe('__proto__'); // Gaps identified: Spec ID accepts prototype pollution key

      // sheetBinding also accepts __proto__
      const specWithProtoBinding = {
        ...minimalValidSpec,
        sheetBinding: '__proto__',
      };
      const parsedBinding = DashboardSpecSchema.parse(specWithProtoBinding);
      expect(parsedBinding.sheetBinding).toBe('__proto__');
    });

    it('rejects SQL injection and path traversal patterns in SafeIdentifierSchema', () => {
      expect(() => SafeIdentifierSchema.parse('col; DROP TABLE users;--')).toThrow();
      expect(() => SafeIdentifierSchema.parse('../../etc/passwd')).toThrow();
      expect(() => SafeIdentifierSchema.parse('col 1')).toThrow();
      expect(() => SafeIdentifierSchema.parse('col-name')).toThrow();
      expect(() => SafeIdentifierSchema.parse('col\0name')).toThrow();
      expect(() => SafeIdentifierSchema.parse('1starts_with_digit')).toThrow();
    });
  });

  // =========================================================================
  // 2. Hostile Formula Injection Strings in Sample Values and Profiles
  // =========================================================================
  describe('2. Formula Injection Attacks', () => {
    it('rejects canonical formula triggers in SampleValueSchema', () => {
      expect(() => SampleValueSchema.parse('=cmd| /C calc!A0')).toThrow();
      expect(() => SampleValueSchema.parse('+SUM(A1:A10)')).toThrow();
      expect(() => SampleValueSchema.parse('-20+30')).toThrow();
      expect(() => SampleValueSchema.parse('@ALERT("XSS")')).toThrow();
      expect(() => SampleValueSchema.parse('\t=cmd')).toThrow();
      expect(() => SampleValueSchema.parse('\r=cmd')).toThrow();
    });

    it('exposes whitespace and newline bypass vectors in SampleValueSchema', () => {
      // Leading space bypass: Excel and Google Sheets can interpret formulas with leading spaces
      const leadingSpaceFormula = ' =cmd|\' /C calc\'!A0';
      const parsedSpace = SampleValueSchema.parse(leadingSpaceFormula);
      expect(parsedSpace).toBe(leadingSpaceFormula); // Gap: leading space formula bypasses /^[=+\-@\t\r]/

      // Leading newline bypass: \n is NOT in [\t\r]
      const leadingNewlineFormula = '\n=1+1';
      const parsedNewline = SampleValueSchema.parse(leadingNewlineFormula);
      expect(parsedNewline).toBe(leadingNewlineFormula); // Gap: \n newline formula bypasses /^[=+\-@\t\r]/

      // Pipe operator bypass: DDE formula can trigger with leading pipe |
      const pipeDdeFormula = '|cmd|\' /C calc\'!A0';
      const parsedPipe = SampleValueSchema.parse(pipeDdeFormula);
      expect(parsedPipe).toBe(pipeDdeFormula); // Gap: DDE pipe formula bypasses /^[=+\-@\t\r]/
    });

    it('exposes formula injection in ColumnProfile topValues (CategoryFrequency)', () => {
      // CategoryFrequencySchema.value uses z.string().max(256), NOT SampleValueSchema
      const maliciousFrequency = CategoryFrequencySchema.parse({
        value: '=cmd|\' /C calc\'!A0',
        count: 10,
        percentage: 100,
      });
      expect(maliciousFrequency.value).toBe('=cmd|\' /C calc\'!A0'); // Gap: topValues allows formula injection
    });

    it('rejects formula injection inside ColumnProfile sampleValues', () => {
      expect(() =>
        ColumnProfileSchema.parse({
          columnKey: 'revenue',
          originalName: 'Revenue',
          inferredType: 'currency',
          semanticRole: 'measure',
          nullable: false,
          nullCount: 0,
          totalCount: 10,
          distinctCount: 10,
          uniquenessRatio: 1.0,
          sampleValues: ['100', '=cmd|calc!A0', '300'],
        })
      ).toThrow();
    });
  });

  // =========================================================================
  // 3. Oversized Payloads Exceeding Max Limits
  // =========================================================================
  describe('3. Oversized Payloads & Limit Enforcement', () => {
    it('strictly enforces sample count capped at 5 and character length capped at 40', () => {
      // > 40 chars
      expect(() => SampleValueSchema.parse('A'.repeat(41))).toThrow();
      expect(SampleValueSchema.parse('A'.repeat(40))).toHaveLength(40);

      // > 5 sample items
      expect(() => SampleValuesArraySchema.parse(['1', '2', '3', '4', '5', '6'])).toThrow();
      expect(SampleValuesArraySchema.parse(['1', '2', '3', '4', '5'])).toHaveLength(5);
    });

    it('enforces string bounds on Titles and Descriptions', () => {
      expect(() => TitleSchema.parse('')).toThrow();
      expect(() => TitleSchema.parse('   ')).toThrow();
      expect(() => TitleSchema.parse('T'.repeat(121))).toThrow();
      expect(TitleSchema.parse('T'.repeat(120))).toHaveLength(120);

      expect(() => DescriptionSchema.parse('D'.repeat(501))).toThrow();
      expect(DescriptionSchema.parse('D'.repeat(500))).toHaveLength(500);
    });

    it('enforces limits on SpecRefinement prompt and history length', () => {
      expect(() =>
        SpecRefinementRequestSchema.parse({
          prompt: '',
          currentSpec: minimalValidSpec,
          profiles: [
            {
              columnKey: 'rev',
              originalName: 'Revenue',
              inferredType: 'number',
              semanticRole: 'measure',
              nullable: false,
              nullCount: 0,
              totalCount: 1,
              distinctCount: 1,
              uniquenessRatio: 1,
              sampleValues: ['1'],
            },
          ],
        })
      ).toThrow();

      expect(() =>
        SpecRefinementRequestSchema.parse({
          prompt: 'P'.repeat(2001),
          currentSpec: minimalValidSpec,
          profiles: [
            {
              columnKey: 'rev',
              originalName: 'Revenue',
              inferredType: 'number',
              semanticRole: 'measure',
              nullable: false,
              nullCount: 0,
              totalCount: 1,
              distinctCount: 1,
              uniquenessRatio: 1,
              sampleValues: ['1'],
            },
          ],
        })
      ).toThrow();
    });

    it('exposes lack of upper bound on widgets in DashboardSpec (DoS vector)', () => {
      // There is no .max() constraint on DashboardSpecSchema.widgets
      const massiveWidgetArray = Array.from({ length: 500 }, (_, i) => ({
        id: `widget_${i}`,
        type: 'kpi' as const,
        title: `Widget ${i}`,
        grid: { x: 0, y: i * 2, w: 4, h: 2 },
        measure: 'revenue',
        aggregation: 'sum' as const,
      }));

      const specWithMassiveWidgets = {
        ...minimalValidSpec,
        widgets: massiveWidgetArray,
      };

      const parsed = DashboardSpecSchema.parse(specWithMassiveWidgets);
      expect(parsed.widgets).toHaveLength(500); // Gap: unconstrained widget array size allows memory exhaustion
    });

    it('exposes unbounded fileSize in WorkbookModelSchema', () => {
      // fileSize has no max bound (e.g. 1 Petabyte or Number.MAX_SAFE_INTEGER)
      const oversizedWb = {
        id: 'wb_giant',
        filename: 'huge.xlsx',
        fileSize: 10 ** 15, // 1 Petabyte
        activeSheetIndex: 0,
        sheets: [
          {
            id: 's1',
            name: 'Sheet1',
            headers: {
              detectedRowIndex: 0,
              confidence: 1,
              originalHeaders: ['h1'],
              sanitizedKeys: ['h1'],
            },
            columns: [{ key: 'h1', originalName: 'h1', columnIndex: 0 }],
            rows: [],
            rowCount: 0,
            columnCount: 1,
          },
        ],
      };
      const parsed = WorkbookModelSchema.parse(oversizedWb);
      expect(parsed.fileSize).toBe(10 ** 15); // Gap: no upper bound on file size
    });
  });

  // =========================================================================
  // 4. Malformed Discriminated Union Widgets & Layout Dimensions
  // =========================================================================
  describe('4. Discriminated Union & Layout Dimension Validation', () => {
    it('strictly rejects unknown widget types in discriminated union', () => {
      const invalidTypes = ['scatter', 'heatmap', 'radar', 'treemap', 'custom_eval', '__proto__', ''];
      for (const t of invalidTypes) {
        expect(() =>
          WidgetSpecSchema.parse({
            id: 'widget_unknown',
            type: t,
            title: 'Unknown',
            grid: { x: 0, y: 0, w: 4, h: 4 },
          })
        ).toThrow();
      }
    });

    it('rejects negative and out-of-bounds widget grid coordinates', () => {
      // Negative x
      expect(() => WidgetGridPositionSchema.parse({ x: -1, y: 0, w: 4, h: 2 })).toThrow();
      // x > 11
      expect(() => WidgetGridPositionSchema.parse({ x: 12, y: 0, w: 4, h: 2 })).toThrow();
      // Negative y
      expect(() => WidgetGridPositionSchema.parse({ x: 0, y: -1, w: 4, h: 2 })).toThrow();
      // Zero or negative width
      expect(() => WidgetGridPositionSchema.parse({ x: 0, y: 0, w: 0, h: 2 })).toThrow();
      expect(() => WidgetGridPositionSchema.parse({ x: 0, y: 0, w: -4, h: 2 })).toThrow();
      // Width > 12
      expect(() => WidgetGridPositionSchema.parse({ x: 0, y: 0, w: 13, h: 2 })).toThrow();
      // Zero or negative height
      expect(() => WidgetGridPositionSchema.parse({ x: 0, y: 0, w: 4, h: 0 })).toThrow();
      expect(() => WidgetGridPositionSchema.parse({ x: 0, y: 0, w: 4, h: -2 })).toThrow();
      // Height > 24
      expect(() => WidgetGridPositionSchema.parse({ x: 0, y: 0, w: 4, h: 25 })).toThrow();
    });

    it('exposes horizontal grid overflow where x + w > 12 columns', () => {
      // x is valid (11 <= 11), w is valid (12 <= 12), but x + w = 23 > 12 columns
      const overflowGrid = WidgetGridPositionSchema.parse({ x: 11, y: 0, w: 12, h: 4 });
      expect(overflowGrid.x + overflowGrid.w).toBe(23); // Gap: grid overflow not validated across x + w
    });

    it('rejects negative layout padding and gap', () => {
      expect(() => DashboardLayoutSchema.parse({ columns: 12, gap: -5, padding: 16 })).toThrow();
      expect(() => DashboardLayoutSchema.parse({ columns: 12, gap: 16, padding: -10 })).toThrow();
      expect(() => DashboardLayoutSchema.parse({ columns: 0, gap: 16, padding: 16 })).toThrow();
      expect(() => DashboardLayoutSchema.parse({ columns: 25, gap: 16, padding: 16 })).toThrow();
    });

    it('enforces widget-specific domain constraints', () => {
      // Donut innerRadius must be 0 <= innerRadius <= 0.9
      expect(() =>
        DonutChartWidgetSpecSchema.parse({
          id: 'donut_err',
          type: 'donut',
          title: 'Donut',
          grid: { x: 0, y: 0, w: 4, h: 4 },
          dimension: 'cat',
          measure: 'val',
          aggregation: 'sum',
          innerRadius: 1.5,
        })
      ).toThrow();

      // Donut maxSlices between 2 and 20
      expect(() =>
        DonutChartWidgetSpecSchema.parse({
          id: 'donut_err2',
          type: 'donut',
          title: 'Donut',
          grid: { x: 0, y: 0, w: 4, h: 4 },
          dimension: 'cat',
          measure: 'val',
          aggregation: 'sum',
          maxSlices: 25,
        })
      ).toThrow();

      // Table pageSize between 5 and 100
      expect(() =>
        TableWidgetSpecSchema.parse({
          id: 'table_err',
          type: 'table',
          title: 'Table',
          grid: { x: 0, y: 0, w: 12, h: 4 },
          columns: [{ columnKey: 'col1', header: 'Col 1' }],
          pageSize: 200,
        })
      ).toThrow();

      // Line chart requires at least one measure
      expect(() =>
        LineChartWidgetSpecSchema.parse({
          id: 'line_err',
          type: 'line',
          title: 'Line',
          grid: { x: 0, y: 0, w: 8, h: 4 },
          timeDimension: 'dt',
          measures: [],
          aggregation: 'sum',
        })
      ).toThrow();
    });
  });

  // =========================================================================
  // 5. Malformed Share Tokens & Entropy Requirements
  // =========================================================================
  describe('5. Share Token Entropy & URL Safety', () => {
    it('rejects short tokens with insufficient entropy (< 22 characters)', () => {
      expect(() => ShareTokenSchema.parse('')).toThrow();
      expect(() => ShareTokenSchema.parse('short')).toThrow();
      expect(() => ShareTokenSchema.parse('123456789012345678901')).toThrow(); // 21 chars
    });

    it('rejects tokens with illegal or unsafe characters', () => {
      expect(() => ShareTokenSchema.parse('k9Z_3Xv8Lm2Qp7Rt1Wy4Bn$#@!')).toThrow();
      expect(() => ShareTokenSchema.parse('k9Z_3Xv8Lm2Qp7Rt1Wy4Bn/path')).toThrow();
      expect(() => ShareTokenSchema.parse('k9Z_3Xv8Lm2Qp7Rt1Wy4Bn?query=1')).toThrow();
      expect(() => ShareTokenSchema.parse('k9Z_3Xv8Lm2Qp7Rt1Wy4Bn ')).toThrow();
      expect(() => ShareTokenSchema.parse('k9Z_3Xv8Lm2Qp7Rt1Wy4Bn<script>')).toThrow();
    });

    it('rejects oversized share tokens exceeding 128 characters', () => {
      expect(() => ShareTokenSchema.parse('A'.repeat(129))).toThrow();
    });

    it('exposes lack of Shannon entropy validation on low-entropy tokens', () => {
      // 22 identical characters pass length and regex, but have minimal entropy
      const lowEntropyToken = 'A'.repeat(22);
      const parsed = ShareTokenSchema.parse(lowEntropyToken);
      expect(parsed).toBe(lowEntropyToken); // Gap: token format checks length/charset, not actual entropy
    });

    it('exposes dangerous URI schemes accepted by CreateShareLinkResponse shareUrl', () => {
      // z.string().url() in Zod accepts javascript:, data:, and file: schemes
      const responseWithXssUrl = {
        shareToken: 'k9Z_3Xv8Lm2Qp7Rt1Wy4Bn',
        shareUrl: 'javascript:alert(document.domain)',
      };
      const parsed = CreateShareLinkResponseSchema.parse(responseWithXssUrl);
      expect(parsed.shareUrl).toBe('javascript:alert(document.domain)'); // Gap: unconstrained protocol allows javascript: URLs
    });
  });

  // =========================================================================
  // 6. SQL and Query Plan Security
  // =========================================================================
  describe('6. Query Plan & Filter Security', () => {
    it('rejects SQL injection payloads in QueryPlan table and column keys', () => {
      expect(() =>
        QueryPlanSchema.parse({
          id: 'q1',
          table: 'users; DROP TABLE users;--',
        })
      ).toThrow();

      expect(() =>
        QueryPlanSchema.parse({
          id: 'q2',
          table: 'valid_table',
          dimensions: ['col; SELECT * FROM credentials;--'],
        })
      ).toThrow();
    });

    it('strictly restricts QueryPlan filter operators to safe enumeration', () => {
      expect(() =>
        QueryPlanSchema.parse({
          id: 'q3',
          table: 'orders',
          filters: [
            {
              columnKey: 'status',
              operator: 'EXEC' as unknown as 'eq',
            },
          ],
        })
      ).toThrow();
    });

    it('enforces limits on QueryPlan limit and offset', () => {
      expect(() =>
        QueryPlanSchema.parse({
          id: 'q4',
          table: 'orders',
          limit: -1,
        })
      ).toThrow();

      expect(() =>
        QueryPlanSchema.parse({
          id: 'q5',
          table: 'orders',
          limit: 50001, // exceeds 50000 limit
        })
      ).toThrow();

      expect(() =>
        QueryPlanSchema.parse({
          id: 'q6',
          table: 'orders',
          offset: -10,
        })
      ).toThrow();
    });
  });

  // =========================================================================
  // 7. Non-Finite Numbers & Floating Point Edge Cases
  // =========================================================================
  describe('7. Floating Point & Numeric Edge Cases (Infinity, -Infinity)', () => {
    it('exposes acceptance of Infinity in NumericStatsSchema', () => {
      // z.number() accepts Infinity unless .finite() is specified
      const statsWithInfinity = {
        min: -Infinity,
        max: Infinity,
        sum: Infinity,
      };
      const parsed = NumericStatsSchema.parse(statsWithInfinity);
      expect(parsed.max).toBe(Infinity);
      expect(parsed.min).toBe(-Infinity); // Gap: Infinity accepted in numeric statistics
    });

    it('exposes acceptance of Infinity in QueryResult executionTimeMs', () => {
      const resultWithInfinity = {
        queryId: 'q_exec_inf',
        columns: [{ name: 'col1', type: 'VARCHAR' }],
        rows: [{ col1: 'val' }],
        rowCount: 1,
        executionTimeMs: Infinity,
      };
      const parsed = QueryResultSchema.parse(resultWithInfinity);
      expect(parsed.executionTimeMs).toBe(Infinity); // Gap: executionTimeMs accepts Infinity
    });
  });
});
