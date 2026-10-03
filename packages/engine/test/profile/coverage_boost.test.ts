import { describe, expect, it } from 'vitest';
import {
  DashboardSpecSchema,
  type DashboardSpec,
  type SheetModel,
  type SheetProfile,
} from '@unsheet/contracts';
import {
  areNamesCompatible,
  detectDrift,
  extractExpectedColumns,
  extractStem,
  findJoinCandidates,
  generateDashboardSpec,
  inferColumnType,
  isCoercible,
  profileSheet,
} from '../../src/index.js';

describe('Coverage Boost Tests for Profile, Specgen, and Drift', () => {
  it('covers all edge cases in type inference', () => {
    // Empty values with various names
    expect(inferColumnType([], { key: 'due_date' }).inferredType).toBe('date');
    expect(inferColumnType([], { key: 'bonus_pct' }).inferredType).toBe('percent');
    expect(inferColumnType([], { key: 'annual_salary' }).inferredType).toBe('currency');
    expect(inferColumnType([], { key: 'order_uuid' }).inferredType).toBe('id');
    expect(inferColumnType([], { key: 'random_col' }).inferredType).toBe('text');

    // Booleans with string True/False, 1/0
    expect(
      inferColumnType(['True', 'False', 'True'], { key: 'is_verified' }).inferredType
    ).toBe('boolean');
    expect(
      inferColumnType([1, 0, 1, 0], { key: 'has_permission_flag' }).inferredType
    ).toBe('boolean');

    // Date serial numbers without header clues
    expect(
      inferColumnType([45200, 45201, 45202], { key: 'planned_milestone' }).inferredType
    ).toBe('date');

    // Currencies with currency symbols
    expect(
      inferColumnType(['$ 100.50', '$ 200.00', '$ 350.25'], { key: 'fee' }).inferredType
    ).toBe('currency');
    expect(
      inferColumnType(['100 USD', '250 USD'], { key: 'payment' }).inferredType
    ).toBe('currency');

    // Numeric IDs (store_id, ticket_id)
    expect(
      inferColumnType([101, 102, 103], { key: 'store_id' }).inferredType
    ).toBe('id');

    // Generic col_2 and col_3
    expect(
      inferColumnType(['Alpha', 'Beta', 'Gamma'], { key: 'col_2' }).inferredType
    ).toBe('text');
  });

  it('covers primary key fallback when no keyword matches', () => {
    const sheet: SheetModel = {
      id: 'sheet_pk_fallback',
      name: 'PK Fallback',
      headers: {
        detectedRowIndex: 0,
        confidence: 1,
        originalHeaders: ['Col Alpha', 'Col Beta'],
        sanitizedKeys: ['col_alpha', 'col_beta'],
      },
      columns: [
        { key: 'col_alpha', originalName: 'Col Alpha', columnIndex: 0 },
        { key: 'col_beta', originalName: 'Col Beta', columnIndex: 1 },
      ],
      rows: [
        { col_alpha: 'ABC', col_beta: 10 },
        { col_alpha: 'DEF', col_beta: 20 },
      ],
      rowCount: 2,
      columnCount: 2,
    };

    const profile = profileSheet(sheet);
    expect(profile).toBeDefined();
  });

  it('covers join candidate branches', () => {
    expect(extractStem('id')).toBe('id');
    expect(areNamesCompatible('id', 'cust_id')).toBe(true);
    expect(areNamesCompatible('cust_id', 'id')).toBe(true);

    // Single sheet workbook produces empty joins
    const emptyJoins = findJoinCandidates([]);
    expect(emptyJoins).toEqual([]);
  });

  it('covers specgen with only donut chart and side-by-side bar chart', () => {
    // Sheet with 1 low cardinality dimension (distinctCount 3), 1 other dimension, and 1 measure, but NO time column
    const profile: SheetProfile = {
      sheetId: 'sheet_donut_only',
      sheetName: 'Donut Only',
      rowCount: 10,
      columnProfiles: [
        {
          columnKey: 'status',
          originalName: 'Status',
          inferredType: 'category',
          semanticRole: 'dimension',
          nullable: false,
          nullCount: 0,
          totalCount: 10,
          distinctCount: 3, // between 2 and 6 -> triggers donut!
          uniquenessRatio: 0.3,
          sampleValues: ['Active', 'Pending'],
        },
        {
          columnKey: 'department',
          originalName: 'Department',
          inferredType: 'category',
          semanticRole: 'dimension',
          nullable: false,
          nullCount: 0,
          totalCount: 10,
          distinctCount: 5,
          uniquenessRatio: 0.5,
          sampleValues: ['Sales', 'HR'],
        },
        {
          columnKey: 'budget',
          originalName: 'Budget',
          inferredType: 'currency',
          semanticRole: 'measure',
          nullable: false,
          nullCount: 0,
          totalCount: 10,
          distinctCount: 10,
          uniquenessRatio: 1.0,
          currencyCode: 'USD',
          sampleValues: ['50000'],
        },
      ],
      recommendedDimensions: ['status', 'department'],
      recommendedMeasures: ['budget'],
    };

    const spec = generateDashboardSpec(profile, { theme: 'dark' });
    expect(DashboardSpecSchema.parse(spec)).toBeDefined();

    const donut = spec.widgets.find((w) => w.type === 'donut');
    expect(donut).toBeDefined();
    expect(donut!.grid.x).toBe(0);
    expect(donut!.grid.w).toBe(6);

    const bar = spec.widgets.find((w) => w.type === 'bar');
    expect(bar).toBeDefined();
    expect(bar!.grid.x).toBe(6); // side by side with donut!
    expect(bar!.grid.w).toBe(6);
  });

  it('covers specgen with exactly 1 measure and 3 measures for KPI grid widths', () => {
    const profile1Measure: SheetProfile = {
      sheetId: 'sheet_1m',
      sheetName: 'One Measure',
      rowCount: 5,
      columnProfiles: [
        {
          columnKey: 'metric_a',
          originalName: 'Metric A',
          inferredType: 'number',
          semanticRole: 'measure',
          nullable: false,
          nullCount: 0,
          totalCount: 5,
          distinctCount: 5,
          uniquenessRatio: 1.0,
          sampleValues: ['10'],
        },
      ],
      recommendedDimensions: [],
      recommendedMeasures: ['metric_a'],
    };

    const spec1 = generateDashboardSpec(profile1Measure);
    const kpi1 = spec1.widgets.find((w) => w.type === 'kpi');
    expect(kpi1!.grid.w).toBe(4);

    const profile3Measure: SheetProfile = {
      sheetId: 'sheet_3m',
      sheetName: 'Three Measures',
      rowCount: 5,
      columnProfiles: [
        {
          columnKey: 'm1',
          originalName: 'M1',
          inferredType: 'number',
          semanticRole: 'measure',
          nullable: false,
          nullCount: 0,
          totalCount: 5,
          distinctCount: 5,
          uniquenessRatio: 1.0,
          sampleValues: ['1'],
        },
        {
          columnKey: 'm2',
          originalName: 'M2',
          inferredType: 'number',
          semanticRole: 'measure',
          nullable: false,
          nullCount: 0,
          totalCount: 5,
          distinctCount: 5,
          uniquenessRatio: 1.0,
          sampleValues: ['2'],
        },
        {
          columnKey: 'm3',
          originalName: 'M3',
          inferredType: 'number',
          semanticRole: 'measure',
          nullable: false,
          nullCount: 0,
          totalCount: 5,
          distinctCount: 5,
          uniquenessRatio: 1.0,
          sampleValues: ['3'],
        },
      ],
      recommendedDimensions: [],
      recommendedMeasures: ['m1', 'm2', 'm3'],
    };

    const spec3 = generateDashboardSpec(profile3Measure);
    const kpis3 = spec3.widgets.filter((w) => w.type === 'kpi');
    expect(kpis3.length).toBe(3);
    expect(kpis3[0]!.grid.w).toBe(4);
    expect(kpis3[1]!.grid.w).toBe(4);
    expect(kpis3[2]!.grid.w).toBe(4);
  });

  it('covers drift detection with templateProfile option and all widget types', () => {
    const fullSpec: DashboardSpec = {
      version: '1.0',
      id: 'spec_full',
      title: 'Full Spec',
      sheetBinding: 'sheet_full',
      layout: { columns: 12, gap: 16, padding: 16 },
      filters: [
        { id: 'f_num', columnKey: 'threshold', label: 'Threshold', type: 'numeric-range' },
        { id: 'f_search', columnKey: 'keyword', label: 'Keyword', type: 'search' },
      ],
      widgets: [
        {
          id: 'kpi_pct',
          type: 'kpi',
          title: 'Rate',
          grid: { x: 0, y: 0, w: 6, h: 2 },
          measure: 'conversion_pct',
          aggregation: 'avg',
          format: { suffix: '%' },
        },
        {
          id: 'donut_dim',
          type: 'donut',
          title: 'Composition',
          grid: { x: 6, y: 0, w: 6, h: 2 },
          dimension: 'status',
          measure: 'revenue',
          aggregation: 'sum',
        },
        {
          id: 'pivot_matrix',
          type: 'pivot',
          title: 'Matrix',
          grid: { x: 0, y: 2, w: 12, h: 6 },
          rowDimensions: ['dept'],
          colDimensions: ['role'],
          measures: [{ columnKey: 'salary', aggregation: 'sum', format: { currency: 'USD' } }],
        },
      ],
    };

    const expectedCols = extractExpectedColumns(fullSpec);
    expect(expectedCols.length).toBeGreaterThanOrEqual(5);

    const templateProfile: SheetProfile = {
      sheetId: 'sheet_tpl',
      sheetName: 'Template',
      rowCount: 10,
      columnProfiles: [
        {
          columnKey: 'threshold',
          originalName: 'Threshold',
          inferredType: 'number',
          semanticRole: 'measure',
          nullable: false,
          nullCount: 0,
          totalCount: 10,
          distinctCount: 5,
          uniquenessRatio: 0.5,
          sampleValues: ['10'],
        },
        {
          columnKey: 'keyword',
          originalName: 'Keyword',
          inferredType: 'text',
          semanticRole: 'dimension',
          nullable: false,
          nullCount: 0,
          totalCount: 10,
          distinctCount: 10,
          uniquenessRatio: 1.0,
          sampleValues: ['Test'],
        },
      ],
      recommendedDimensions: ['keyword'],
      recommendedMeasures: ['threshold'],
    };

    const newProfile: SheetProfile = {
      sheetId: 'sheet_new',
      sheetName: 'New Sheet',
      rowCount: 10,
      columnProfiles: [
        {
          columnKey: 'threshold',
          originalName: 'Threshold',
          inferredType: 'number',
          semanticRole: 'measure',
          nullable: false,
          nullCount: 0,
          totalCount: 10,
          distinctCount: 5,
          uniquenessRatio: 0.5,
          sampleValues: ['10'],
        },
        {
          columnKey: 'search_term', // Renamed from keyword
          originalName: 'Search Term',
          inferredType: 'text',
          semanticRole: 'dimension',
          nullable: false,
          nullCount: 0,
          totalCount: 10,
          distinctCount: 10,
          uniquenessRatio: 1.0,
          sampleValues: ['Test'],
        },
      ],
      recommendedDimensions: ['search_term'],
      recommendedMeasures: ['threshold'],
    };

    const report = detectDrift(fullSpec, newProfile, { templateProfile });
    expect(report.templateId).toBe('spec_full');
    expect(report.matchedColumns.length).toBe(1);
    expect(report.missingColumns).toContain('keyword');
    expect(report.addedColumns[0]!.columnKey).toBe('search_term');
  });

  it('covers all coercion branches', () => {
    expect(isCoercible('text', 'number')).toBe(true);
    expect(isCoercible('category', 'text')).toBe(true);
    expect(isCoercible('category', 'boolean')).toBe(true);
    expect(isCoercible('id', 'category')).toBe(true);
    expect(isCoercible('id', 'text')).toBe(true);
    expect(isCoercible('boolean', 'number')).toBe(true);
    expect(isCoercible('boolean', 'category')).toBe(true);
    expect(isCoercible('number', 'text')).toBe(false);
  });
});
