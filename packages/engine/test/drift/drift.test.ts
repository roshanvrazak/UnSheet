import { describe, expect, it } from 'vitest';
import {
  DriftReportSchema,
  type DashboardSpec,
  type SheetProfile,
} from '@unsheet/contracts';
import {
  calculateColumnSimilarity,
  detectDrift,
  isCoercible,
  levenshteinDistance,
  tokenJaccardSimilarity,
} from '../../src/index.js';

describe('Schema Drift Detection Unit Tests', () => {
  const baseSpec: DashboardSpec = {
    version: '1.0',
    id: 'dash_sales_v1',
    title: 'Sales Dashboard',
    sheetBinding: 'sheet_sales',
    layout: { columns: 12, gap: 16, padding: 16 },
    filters: [
      {
        id: 'f_date',
        columnKey: 'order_date',
        label: 'Order Date',
        type: 'date-range',
      },
      {
        id: 'f_category',
        columnKey: 'category',
        label: 'Category',
        type: 'select',
      },
    ],
    widgets: [
      {
        id: 'kpi_revenue',
        type: 'kpi',
        title: 'Total Revenue',
        grid: { x: 0, y: 0, w: 6, h: 2 },
        measure: 'revenue',
        aggregation: 'sum',
        format: { currency: 'USD' },
      },
      {
        id: 'line_trend',
        type: 'line',
        title: 'Revenue Trend',
        grid: { x: 0, y: 2, w: 12, h: 5 },
        timeDimension: 'order_date',
        measures: ['revenue'],
        aggregation: 'sum',
      },
      {
        id: 'table_summary',
        type: 'table',
        title: 'Orders',
        grid: { x: 0, y: 7, w: 12, h: 6 },
        columns: [
          { columnKey: 'order_id', header: 'Order ID' },
          { columnKey: 'category', header: 'Category' },
          { columnKey: 'revenue', header: 'Revenue' },
        ],
      },
    ],
  };

  const matchingProfile: SheetProfile = {
    sheetId: 'sheet_sales_new',
    sheetName: 'New Sales Data',
    rowCount: 200,
    columnProfiles: [
      {
        columnKey: 'order_id',
        originalName: 'Order ID',
        inferredType: 'id',
        semanticRole: 'identifier',
        nullable: false,
        nullCount: 0,
        totalCount: 200,
        distinctCount: 200,
        uniquenessRatio: 1.0,
        sampleValues: ['ORD-1'],
      },
      {
        columnKey: 'order_date',
        originalName: 'Order Date',
        inferredType: 'date',
        semanticRole: 'time',
        nullable: false,
        nullCount: 0,
        totalCount: 200,
        distinctCount: 80,
        uniquenessRatio: 0.4,
        sampleValues: ['2024-02-01'],
      },
      {
        columnKey: 'category',
        originalName: 'Category',
        inferredType: 'category',
        semanticRole: 'dimension',
        nullable: false,
        nullCount: 0,
        totalCount: 200,
        distinctCount: 5,
        uniquenessRatio: 0.025,
        sampleValues: ['Electronics'],
      },
      {
        columnKey: 'revenue',
        originalName: 'Revenue',
        inferredType: 'currency',
        semanticRole: 'measure',
        nullable: false,
        nullCount: 0,
        totalCount: 200,
        distinctCount: 150,
        uniquenessRatio: 0.75,
        currencyCode: 'USD',
        sampleValues: ['1200.00'],
      },
      {
        columnKey: 'notes',
        originalName: 'Notes',
        inferredType: 'text',
        semanticRole: 'dimension',
        nullable: true,
        nullCount: 50,
        totalCount: 200,
        distinctCount: 100,
        uniquenessRatio: 0.5,
        sampleValues: ['Rush order'],
      },
    ],
    primaryKeyCandidate: 'order_id',
    recommendedDimensions: ['category'],
    recommendedMeasures: ['revenue'],
    recommendedTimeColumn: 'order_date',
  };

  it('detects matched columns and added columns with 100% confidence when schema matches', () => {
    const report = detectDrift(baseSpec, matchingProfile);

    // Validate with Zod DriftReportSchema
    const parsed = DriftReportSchema.parse(report);
    expect(parsed.templateId).toBe('dash_sales_v1');
    expect(parsed.sourceSheetName).toBe('New Sales Data');
    expect(parsed.hasBreakingChanges).toBe(false);
    expect(parsed.overallConfidence).toBeGreaterThanOrEqual(0.9);

    expect(parsed.missingColumns).toEqual([]);
    expect(parsed.typeMismatches).toEqual([]);
    expect(parsed.addedColumns.length).toBe(1);
    expect(parsed.addedColumns[0]!.columnKey).toBe('notes');

    const matchedKeys = parsed.matchedColumns.map((m) => m.expectedKey);
    expect(matchedKeys).toContain('order_id');
    expect(matchedKeys).toContain('order_date');
    expect(matchedKeys).toContain('category');
    expect(matchedKeys).toContain('revenue');
  });

  it('detects missing columns and suggests high-confidence remappings for renamed columns', () => {
    const renamedProfile: SheetProfile = {
      sheetId: 'sheet_renamed',
      sheetName: 'Renamed Sales',
      rowCount: 50,
      columnProfiles: [
        {
          columnKey: 'order_id',
          originalName: 'Order ID',
          inferredType: 'id',
          semanticRole: 'identifier',
          nullable: false,
          nullCount: 0,
          totalCount: 50,
          distinctCount: 50,
          uniquenessRatio: 1.0,
          sampleValues: ['ORD-1'],
        },
        {
          columnKey: 'order_date',
          originalName: 'Order Date',
          inferredType: 'date',
          semanticRole: 'time',
          nullable: false,
          nullCount: 0,
          totalCount: 50,
          distinctCount: 40,
          uniquenessRatio: 0.8,
          sampleValues: ['2024-02-01'],
        },
        {
          columnKey: 'product_category', // Renamed from 'category'
          originalName: 'Product Category',
          inferredType: 'category',
          semanticRole: 'dimension',
          nullable: false,
          nullCount: 0,
          totalCount: 50,
          distinctCount: 4,
          uniquenessRatio: 0.08,
          sampleValues: ['Office Supplies'],
        },
        {
          columnKey: 'total_revenue', // Renamed from 'revenue'
          originalName: 'Total Revenue',
          inferredType: 'currency',
          semanticRole: 'measure',
          nullable: false,
          nullCount: 0,
          totalCount: 50,
          distinctCount: 45,
          uniquenessRatio: 0.9,
          currencyCode: 'USD',
          sampleValues: ['850.00'],
        },
      ],
      primaryKeyCandidate: 'order_id',
      recommendedDimensions: ['product_category'],
      recommendedMeasures: ['total_revenue'],
      recommendedTimeColumn: 'order_date',
    };

    const report = detectDrift(baseSpec, renamedProfile);
    expect(DriftReportSchema.parse(report)).toBeDefined();

    expect(report.missingColumns).toContain('category');
    expect(report.missingColumns).toContain('revenue');

    const categoryRemap = report.suggestedRemappings.find((r) => r.missingKey === 'category');
    expect(categoryRemap).toBeDefined();
    expect(categoryRemap!.suggestedKey).toBe('product_category');
    expect(categoryRemap!.confidence).toBeGreaterThanOrEqual(0.6);

    const revenueRemap = report.suggestedRemappings.find((r) => r.missingKey === 'revenue');
    expect(revenueRemap).toBeDefined();
    expect(revenueRemap!.suggestedKey).toBe('total_revenue');
    expect(revenueRemap!.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('detects coercible and non-coercible type mismatches correctly', () => {
    const typeMismatchProfile: SheetProfile = {
      sheetId: 'sheet_types',
      sheetName: 'Type Mismatches',
      rowCount: 50,
      columnProfiles: [
        {
          columnKey: 'order_id',
          originalName: 'Order ID',
          inferredType: 'id',
          semanticRole: 'identifier',
          nullable: false,
          nullCount: 0,
          totalCount: 50,
          distinctCount: 50,
          uniquenessRatio: 1.0,
          sampleValues: ['ORD-1'],
        },
        {
          columnKey: 'order_date',
          originalName: 'Order Date',
          inferredType: 'number', // Date changed to number: non-coercible!
          semanticRole: 'measure',
          nullable: false,
          nullCount: 0,
          totalCount: 50,
          distinctCount: 50,
          uniquenessRatio: 1.0,
          sampleValues: ['12345'],
        },
        {
          columnKey: 'category',
          originalName: 'Category',
          inferredType: 'text', // Category changed to text: coercible!
          semanticRole: 'dimension',
          nullable: false,
          nullCount: 0,
          totalCount: 50,
          distinctCount: 50,
          uniquenessRatio: 1.0,
          sampleValues: ['Electronics'],
        },
        {
          columnKey: 'revenue',
          originalName: 'Revenue',
          inferredType: 'number', // Currency changed to plain number: coercible!
          semanticRole: 'measure',
          nullable: false,
          nullCount: 0,
          totalCount: 50,
          distinctCount: 50,
          uniquenessRatio: 1.0,
          sampleValues: ['500'],
        },
      ],
      primaryKeyCandidate: 'order_id',
      recommendedDimensions: ['category'],
      recommendedMeasures: ['revenue'],
    };

    const report = detectDrift(baseSpec, typeMismatchProfile);
    expect(DriftReportSchema.parse(report)).toBeDefined();

    expect(report.hasBreakingChanges).toBe(true); // Non-coercible date -> number
    const dateMismatch = report.typeMismatches.find((tm) => tm.columnKey === 'order_date');
    expect(dateMismatch).toBeDefined();
    expect(dateMismatch!.isCoercible).toBe(false);

    const revenueMismatch = report.typeMismatches.find((tm) => tm.columnKey === 'revenue');
    expect(revenueMismatch).toBeDefined();
    expect(revenueMismatch!.isCoercible).toBe(true);
  });

  describe('String Similarity Utilities', () => {
    it('computes Levenshtein distance accurately', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('', 'hello')).toBe(5);
      expect(levenshteinDistance('same', 'same')).toBe(0);
    });

    it('computes token Jaccard similarity', () => {
      expect(tokenJaccardSimilarity('customer_name', 'customer_full_name')).toBe(2 / 3);
      expect(tokenJaccardSimilarity('sales_usd', 'sales_usd')).toBe(1.0);
      expect(tokenJaccardSimilarity('alpha', 'beta')).toBe(0.0);
    });

    it('calculates column similarity', () => {
      expect(calculateColumnSimilarity('product_category', 'category')).toBeGreaterThanOrEqual(0.6);
      expect(calculateColumnSimilarity('emp_name', 'employee_name')).toBeGreaterThanOrEqual(0.6);
      expect(calculateColumnSimilarity('totally_unrelated', 'something_else')).toBeLessThan(0.4);
    });
  });

  describe('Type Coercion Rules', () => {
    it('verifies coercibility rules', () => {
      expect(isCoercible('number', 'currency')).toBe(true);
      expect(isCoercible('currency', 'number')).toBe(true);
      expect(isCoercible('percent', 'number')).toBe(true);
      expect(isCoercible('text', 'id')).toBe(true);
      expect(isCoercible('text', 'date')).toBe(true);
      expect(isCoercible('category', 'id')).toBe(true);
      expect(isCoercible('category', 'boolean')).toBe(true);

      expect(isCoercible('number', 'text')).toBe(false);
      expect(isCoercible('date', 'number')).toBe(false);
      expect(isCoercible('currency', 'boolean')).toBe(false);
    });
  });
});
