import { describe, it, expect } from 'vitest';
import {
  SafeIdentifierSchema,
  SampleValueSchema,
  SampleValuesArraySchema,
  CellModelSchema,
  HeaderMetadataSchema,
  ColumnMetadataSchema,
  SheetModelSchema,
  WorkbookModelSchema,
  ColumnProfileSchema,
  SheetProfileSchema,
  DashboardSpecSchema,
  WidgetSpecSchema,
  KPIWidgetSpecSchema,
  LineChartWidgetSpecSchema,
  BarChartWidgetSpecSchema,
  DonutChartWidgetSpecSchema,
  TableWidgetSpecSchema,
  PivotTableWidgetSpecSchema,
  SchemaFingerprintSchema,
  TemplateSchema,
  DriftReportSchema,
  QueryPlanSchema,
  QueryResultSchema,
  SpecRefinementRequestSchema,
  SpecRefinementResponseSchema,
  ShareTokenSchema,
  CreateShareLinkRequestSchema,
  AskYourDataRequestSchema,
  AskYourDataResponseSchema,
  type DashboardSpec,
  type WorkbookModel,
} from '../src/index.js';

describe('Common & Identifier Contracts', () => {
  it('accepts valid safe identifiers', () => {
    expect(SafeIdentifierSchema.parse('revenue_q1')).toBe('revenue_q1');
    expect(SafeIdentifierSchema.parse('Column_123')).toBe('Column_123');
    expect(SafeIdentifierSchema.parse('_id')).toBe('_id');
  });

  it('rejects prototype pollution keys and malformed identifiers', () => {
    expect(() => SafeIdentifierSchema.parse('__proto__')).toThrow();
    expect(() => SafeIdentifierSchema.parse('constructor')).toThrow();
    expect(() => SafeIdentifierSchema.parse('prototype')).toThrow();
    expect(() => SafeIdentifierSchema.parse('invalid space')).toThrow();
    expect(() => SafeIdentifierSchema.parse('123starts_with_num')).toThrow();
    expect(() => SafeIdentifierSchema.parse('invalid-hyphen')).toThrow();
  });

  it('enforces sample value bounds and formula injection neutralization', () => {
    expect(SampleValueSchema.parse('Normal Value')).toBe('Normal Value');
    expect(SampleValueSchema.parse('12345')).toBe('12345');

    // Rejects formula injection prefixes
    expect(() => SampleValueSchema.parse('=SUM(A1:A10)')).toThrow();
    expect(() => SampleValueSchema.parse('+cmd.exe')).toThrow();
    expect(() => SampleValueSchema.parse('-20+30')).toThrow();
    expect(() => SampleValueSchema.parse('@SUM(B1)')).toThrow();
    expect(() => SampleValueSchema.parse('\tTabbed')).toThrow();
    expect(() => SampleValueSchema.parse('\rCarriage')).toThrow();

    // Rejects oversized sample value (> 40 chars)
    const longString = 'a'.repeat(41);
    expect(() => SampleValueSchema.parse(longString)).toThrow();

    // Capped at 5 items
    expect(SampleValuesArraySchema.parse(['A', 'B', 'C', 'D', 'E'])).toHaveLength(5);
    expect(() => SampleValuesArraySchema.parse(['A', 'B', 'C', 'D', 'E', 'F'])).toThrow();
  });
});

describe('Workbook & Sheet Contracts', () => {
  it('validates a well-formed WorkbookModel', () => {
    const validWorkbook: WorkbookModel = {
      id: 'wb-001',
      filename: 'sales_2026.xlsx',
      fileSize: 45200,
      activeSheetIndex: 0,
      sheets: [
        {
          id: 'sheet-001',
          name: 'Sales Data',
          headers: {
            detectedRowIndex: 0,
            confidence: 0.98,
            originalHeaders: ['Order ID', 'Total Amount', 'Region'],
            sanitizedKeys: ['order_id', 'total_amount', 'region'],
          },
          columns: [
            { key: 'order_id', originalName: 'Order ID', columnIndex: 0 },
            { key: 'total_amount', originalName: 'Total Amount', columnIndex: 1 },
            { key: 'region', originalName: 'Region', columnIndex: 2 },
          ],
          rows: [
            { order_id: 'ORD-1', total_amount: 150.5, region: 'North' },
            { order_id: 'ORD-2', total_amount: 320.0, region: 'South' },
          ],
          rowCount: 2,
          columnCount: 3,
        },
      ],
      metadata: {
        fileType: 'xlsx',
        sheetCount: 1,
      },
    };

    const parsed = WorkbookModelSchema.parse(validWorkbook);
    expect(parsed.sheets[0]?.name).toBe('Sales Data');
    expect(parsed.sheets[0]?.rowCount).toBe(2);
  });

  it('rejects workbooks with zero sheets or invalid column keys', () => {
    expect(() =>
      WorkbookModelSchema.parse({
        id: 'wb-002',
        filename: 'empty.csv',
        fileSize: 100,
        activeSheetIndex: 0,
        sheets: [],
      })
    ).toThrow();

    expect(() =>
      SheetModelSchema.parse({
        id: 'sheet-err',
        name: 'Invalid Sheet',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: ['__proto__'],
          sanitizedKeys: ['__proto__'],
        },
        columns: [{ key: '__proto__', originalName: '__proto__', columnIndex: 0 }],
        rows: [],
        rowCount: 0,
        columnCount: 1,
      })
    ).toThrow();
  });

  it('validates CellModel with origin coordinates', () => {
    const cell = CellModelSchema.parse({
      rowIndex: 0,
      columnIndex: 1,
      raw: 4500,
      formatted: '$4,500.00',
      type: 'number',
      origin: 'B1',
    });
    expect(cell.origin).toBe('B1');
    expect(cell.type).toBe('number');
  });

  it('validates HeaderMetadata and ColumnMetadata individually', () => {
    const header = HeaderMetadataSchema.parse({
      detectedRowIndex: 1,
      confidence: 0.95,
      originalHeaders: ['Department', 'Budget'],
      sanitizedKeys: ['department', 'budget'],
    });
    expect(header.sanitizedKeys).toHaveLength(2);

    const col = ColumnMetadataSchema.parse({
      key: 'budget',
      originalName: 'Budget',
      columnIndex: 1,
    });
    expect(col.key).toBe('budget');
  });
});

describe('Column Profile & Sheet Profile Contracts', () => {
  it('validates a complete ColumnProfile', () => {
    const profile = ColumnProfileSchema.parse({
      columnKey: 'annual_revenue',
      originalName: 'Annual Revenue',
      inferredType: 'currency',
      semanticRole: 'measure',
      nullable: false,
      nullCount: 0,
      totalCount: 100,
      distinctCount: 95,
      uniquenessRatio: 0.95,
      currencyCode: 'USD',
      stats: {
        min: 1000,
        max: 500000,
        mean: 125000,
        median: 110000,
        sum: 12500000,
        stdDev: 25000,
      },
      sampleValues: ['12000', '45000', '98000', '150000', '320000'],
    });

    expect(profile.inferredType).toBe('currency');
    expect(profile.semanticRole).toBe('measure');
    expect(profile.sampleValues).toHaveLength(5);
  });

  it('rejects profiles with more than 5 sample values or formula characters', () => {
    expect(() =>
      ColumnProfileSchema.parse({
        columnKey: 'bad_samples',
        originalName: 'Bad',
        inferredType: 'text',
        semanticRole: 'dimension',
        nullable: true,
        nullCount: 1,
        totalCount: 10,
        distinctCount: 5,
        uniquenessRatio: 0.5,
        sampleValues: ['1', '2', '3', '4', '5', '6'],
      })
    ).toThrow();

    expect(() =>
      ColumnProfileSchema.parse({
        columnKey: 'bad_formula_sample',
        originalName: 'Formula Sample',
        inferredType: 'text',
        semanticRole: 'dimension',
        nullable: false,
        nullCount: 0,
        totalCount: 1,
        distinctCount: 1,
        uniquenessRatio: 1,
        sampleValues: ['=1+1'],
      })
    ).toThrow();
  });

  it('validates SheetProfile recommendations', () => {
    const sheetProfile = SheetProfileSchema.parse({
      sheetId: 'sheet-1',
      sheetName: 'Orders',
      rowCount: 100,
      columnProfiles: [
        {
          columnKey: 'order_date',
          originalName: 'Order Date',
          inferredType: 'date',
          semanticRole: 'time',
          nullable: false,
          nullCount: 0,
          totalCount: 100,
          distinctCount: 80,
          uniquenessRatio: 0.8,
          sampleValues: ['2026-01-01', '2026-01-02'],
        },
      ],
      recommendedDimensions: [],
      recommendedMeasures: [],
      recommendedTimeColumn: 'order_date',
    });

    expect(sheetProfile.recommendedTimeColumn).toBe('order_date');
  });
});

describe('DashboardSpec & Widget Contracts', () => {
  const sampleSpec: DashboardSpec = {
    version: '1.0',
    id: 'dash-001',
    title: 'Executive Financial Summary',
    description: 'Quarterly breakdown of revenue, margin, and regional volume.',
    sheetBinding: 'sheet-001',
    layout: { columns: 12, gap: 16, padding: 16 },
    filters: [
      {
        id: 'filter_region',
        columnKey: 'region',
        label: 'Region',
        type: 'select',
        options: [
          { label: 'North America', value: 'NA' },
          { label: 'Europe', value: 'EU' },
        ],
      },
    ],
    widgets: [
      {
        id: 'kpi_total_revenue',
        type: 'kpi',
        title: 'Total Revenue',
        grid: { x: 0, y: 0, w: 4, h: 2 },
        measure: 'revenue',
        aggregation: 'sum',
        format: { prefix: '$', notation: 'compact' },
        comparison: { previousValue: 1200000, targetValue: 1500000, changeType: 'percent' },
      },
      {
        id: 'line_revenue_trend',
        type: 'line',
        title: 'Monthly Revenue Trend',
        grid: { x: 4, y: 0, w: 8, h: 4 },
        timeDimension: 'order_date',
        measures: ['revenue'],
        aggregation: 'sum',
        timeGranularity: 'month',
        showLegend: true,
        showGrid: true,
      },
      {
        id: 'bar_revenue_by_region',
        type: 'bar',
        title: 'Revenue by Region',
        grid: { x: 0, y: 2, w: 6, h: 4 },
        dimension: 'region',
        measures: ['revenue'],
        aggregation: 'sum',
        orientation: 'vertical',
      },
      {
        id: 'donut_category_share',
        type: 'donut',
        title: 'Category Share',
        grid: { x: 6, y: 2, w: 6, h: 4 },
        dimension: 'category',
        measure: 'revenue',
        aggregation: 'sum',
        innerRadius: 0.6,
      },
      {
        id: 'table_top_transactions',
        type: 'table',
        title: 'Top Transactions',
        grid: { x: 0, y: 6, w: 12, h: 4 },
        columns: [
          { columnKey: 'order_id', header: 'Order ID' },
          { columnKey: 'revenue', header: 'Revenue', align: 'right' },
        ],
        pageSize: 10,
        sortable: true,
      },
      {
        id: 'pivot_region_by_category',
        type: 'pivot',
        title: 'Region by Category Pivot',
        grid: { x: 0, y: 10, w: 12, h: 4 },
        rowDimensions: ['region'],
        colDimensions: ['category'],
        measures: [{ columnKey: 'revenue', aggregation: 'sum', label: 'Total Revenue' }],
        showTotals: true,
      },
    ],
  };

  it('validates a complete dashboard spec with all 6 widget variants', () => {
    const parsed = DashboardSpecSchema.parse(sampleSpec);
    expect(parsed.version).toBe('1.0');
    expect(parsed.widgets).toHaveLength(6);
  });

  it('strictly rejects unknown widget types via discriminated union', () => {
    const invalidWidget = {
      id: 'scatter_unknown',
      type: 'scatter',
      title: 'Unknown Widget',
      grid: { x: 0, y: 0, w: 4, h: 4 },
    };

    expect(() => WidgetSpecSchema.parse(invalidWidget)).toThrow();

    const specWithUnknownWidget = {
      ...sampleSpec,
      widgets: [invalidWidget],
    };

    expect(() => DashboardSpecSchema.parse(specWithUnknownWidget)).toThrow();
  });

  it('rejects invalid grid coordinates', () => {
    expect(() =>
      KPIWidgetSpecSchema.parse({
        id: 'kpi_err',
        type: 'kpi',
        title: 'Invalid Grid',
        grid: { x: 12, y: 0, w: 4, h: 2 }, // x max is 11
        measure: 'rev',
        aggregation: 'sum',
      })
    ).toThrow();

    expect(() =>
      KPIWidgetSpecSchema.parse({
        id: 'kpi_err2',
        type: 'kpi',
        title: 'Invalid Grid',
        grid: { x: 0, y: 0, w: 0, h: 2 }, // w min is 1
        measure: 'rev',
        aggregation: 'sum',
      })
    ).toThrow();
  });

  it('rejects line charts without timeDimension or bar charts without dimension', () => {
    expect(() =>
      LineChartWidgetSpecSchema.parse({
        id: 'line_err',
        type: 'line',
        title: 'No Time Dimension',
        grid: { x: 0, y: 0, w: 6, h: 4 },
        measures: ['rev'],
        aggregation: 'sum',
      })
    ).toThrow();

    expect(() =>
      BarChartWidgetSpecSchema.parse({
        id: 'bar_err',
        type: 'bar',
        title: 'No Dimension',
        grid: { x: 0, y: 0, w: 6, h: 4 },
        measures: ['rev'],
        aggregation: 'sum',
      })
    ).toThrow();
  });

  it('validates Donut, Table, and PivotTable widget schemas individually', () => {
    const donut = DonutChartWidgetSpecSchema.parse({
      id: 'donut_1',
      type: 'donut',
      title: 'Share by Category',
      grid: { x: 0, y: 0, w: 6, h: 4 },
      dimension: 'category',
      measure: 'amount',
      aggregation: 'sum',
      innerRadius: 0.5,
    });
    expect(donut.innerRadius).toBe(0.5);

    const table = TableWidgetSpecSchema.parse({
      id: 'table_1',
      type: 'table',
      title: 'Detailed Records',
      grid: { x: 0, y: 0, w: 12, h: 6 },
      columns: [{ columnKey: 'id', header: 'ID' }],
      pageSize: 20,
    });
    expect(table.pageSize).toBe(20);

    const pivot = PivotTableWidgetSpecSchema.parse({
      id: 'pivot_1',
      type: 'pivot',
      title: 'Matrix Summary',
      grid: { x: 0, y: 0, w: 12, h: 6 },
      rowDimensions: ['region'],
      measures: [{ columnKey: 'amount', aggregation: 'sum' }],
      showTotals: true,
    });
    expect(pivot.showTotals).toBe(true);
  });
});

describe('Template & Schema Fingerprint Contracts', () => {
  it('validates SchemaFingerprint and Template', () => {
    const validFingerprint = {
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      version: '1.0' as const,
      columnCount: 2,
      columns: [
        { key: 'date', name: 'Date', inferredType: 'date' as const, required: true },
        { key: 'revenue', name: 'Revenue', inferredType: 'currency' as const, required: true },
      ],
    };

    expect(SchemaFingerprintSchema.parse(validFingerprint).hash).toHaveLength(64);

    const validTemplate = {
      id: 'tmpl-finance-01',
      name: 'Financial Performance Dashboard',
      description: 'Standard P&L and revenue overview.',
      category: 'financial' as const,
      fingerprint: validFingerprint,
      spec: {
        version: '1.0' as const,
        id: 'dash-tmpl-01',
        title: 'Financial Overview',
        sheetBinding: 'financials',
        layout: { columns: 12, gap: 16, padding: 16 },
        filters: [],
        widgets: [
          {
            id: 'kpi_rev',
            type: 'kpi' as const,
            title: 'Revenue',
            grid: { x: 0, y: 0, w: 4, h: 2 },
            measure: 'revenue',
            aggregation: 'sum' as const,
          },
        ],
      },
      createdAt: '2026-10-04T00:00:00Z',
      updatedAt: '2026-10-04T00:00:00Z',
      isBuiltIn: true,
    };

    const parsedTemplate = TemplateSchema.parse(validTemplate);
    expect(parsedTemplate.category).toBe('financial');
    expect(parsedTemplate.isBuiltIn).toBe(true);
  });

  it('rejects invalid hash in fingerprint', () => {
    expect(() =>
      SchemaFingerprintSchema.parse({
        hash: 'not-a-sha256-hash',
        version: '1.0',
        columnCount: 1,
        columns: [{ key: 'x', name: 'X', inferredType: 'number', required: true }],
      })
    ).toThrow();
  });
});

describe('Drift Report Contracts', () => {
  it('validates a complete DriftReport', () => {
    const report = DriftReportSchema.parse({
      templateId: 'tmpl-001',
      sourceSheetName: 'Q3_Updated',
      overallConfidence: 0.88,
      hasBreakingChanges: false,
      matchedColumns: [{ expectedKey: 'revenue', actualKey: 'total_revenue', confidence: 0.95 }],
      missingColumns: ['tax_amount'],
      addedColumns: [
        {
          columnKey: 'discount_code',
          originalName: 'Discount Code',
          inferredType: 'category',
          sampleValues: ['SUMMER26', 'FALL26'],
        },
      ],
      typeMismatches: [
        {
          columnKey: 'zip_code',
          expectedType: 'id',
          actualType: 'number',
          isCoercible: true,
        },
      ],
      suggestedRemappings: [
        {
          missingKey: 'tax_amount',
          suggestedKey: 'vat_amount',
          confidence: 0.85,
          rationale: 'VAT is the European equivalent of tax',
        },
      ],
    });

    expect(report.overallConfidence).toBe(0.88);
    expect(report.hasBreakingChanges).toBe(false);
    expect(report.matchedColumns[0]?.expectedKey).toBe('revenue');
  });
});

describe('Query Plan & Result Contracts', () => {
  it('validates QueryPlan and QueryResult', () => {
    const plan = QueryPlanSchema.parse({
      id: 'query-001',
      table: 'sales_sheet',
      dimensions: ['region', 'category'],
      aggregations: [
        { columnKey: 'amount', function: 'sum', alias: 'total_amount' },
        { columnKey: 'order_id', function: 'distinctCount', alias: 'order_count' },
      ],
      filters: [
        { columnKey: 'status', operator: 'eq', value: 'Completed' },
        { columnKey: 'amount', operator: 'gte', value: 100 },
      ],
      orderBy: [{ columnKey: 'total_amount', direction: 'desc' }],
      limit: 100,
    });

    expect(plan.aggregations).toHaveLength(2);
    expect(plan.filters).toHaveLength(2);

    const result = QueryResultSchema.parse({
      queryId: 'query-001',
      columns: [
        { name: 'region', type: 'VARCHAR' },
        { name: 'category', type: 'VARCHAR' },
        { name: 'total_amount', type: 'DOUBLE' },
        { name: 'order_count', type: 'BIGINT' },
      ],
      rows: [
        { region: 'North', category: 'Hardware', total_amount: 54000.5, order_count: 120 },
      ],
      rowCount: 1,
      executionTimeMs: 14.2,
      cached: false,
    });

    expect(result.rowCount).toBe(1);
    expect(result.rows[0]?.region).toBe('North');
  });

  it('rejects invalid query operators', () => {
    expect(() =>
      QueryPlanSchema.parse({
        id: 'q-err',
        table: 'sales',
        filters: [{ columnKey: 'status', operator: 'dangerous_custom_op' }],
      })
    ).toThrow();
  });
});

describe('API Payloads Contracts', () => {
  it('validates SpecRefinementRequest and SpecRefinementResponse', () => {
    const request = SpecRefinementRequestSchema.parse({
      prompt: 'Change the bar chart to show profit instead of revenue and group by quarter.',
      currentSpec: {
        version: '1.0',
        id: 'dash-refine',
        title: 'Overview',
        sheetBinding: 'sales',
        layout: { columns: 12, gap: 16, padding: 16 },
        filters: [],
        widgets: [
          {
            id: 'kpi_1',
            type: 'kpi',
            title: 'Rev',
            grid: { x: 0, y: 0, w: 4, h: 2 },
            measure: 'revenue',
            aggregation: 'sum',
          },
        ],
      },
      profiles: [
        {
          columnKey: 'profit',
          originalName: 'Net Profit',
          inferredType: 'currency',
          semanticRole: 'measure',
          nullable: false,
          nullCount: 0,
          totalCount: 50,
          distinctCount: 45,
          uniquenessRatio: 0.9,
          sampleValues: ['100', '250', '400'],
        },
      ],
    });

    expect(request.prompt).toContain('profit');

    const response = SpecRefinementResponseSchema.parse({
      success: true,
      explanation: 'Updated the chart measure to profit and grouped by quarter.',
      appliedChanges: ['Modified widget kpi_1 measure to profit'],
    });

    expect(response.success).toBe(true);
  });

  it('enforces ShareToken >= 128-bit entropy (>=22 characters)', () => {
    const validToken = 'k9Z_3Xv8Lm2Qp7Rt1Wy4Bn'; // 22 chars
    expect(ShareTokenSchema.parse(validToken)).toBe(validToken);

    // Rejects short token (< 22 chars)
    expect(() => ShareTokenSchema.parse('short-token-123')).toThrow();

    // Rejects token with special illegal chars
    expect(() => ShareTokenSchema.parse('k9Z_3Xv8Lm2Qp7Rt1Wy4Bn$#@!')).toThrow();
  });

  it('validates CreateShareLinkRequest and limits snapshot records', () => {
    const shareReq = CreateShareLinkRequestSchema.parse({
      title: 'Shared Executive Dashboard',
      spec: {
        version: '1.0',
        id: 'dash-share',
        title: 'Shared Dash',
        sheetBinding: 'sheet1',
        layout: { columns: 12, gap: 16, padding: 16 },
        filters: [],
        widgets: [
          {
            id: 'kpi_share',
            type: 'kpi',
            title: 'Total',
            grid: { x: 0, y: 0, w: 4, h: 2 },
            measure: 'val',
            aggregation: 'count',
          },
        ],
      },
      allowExport: true,
      expiresInHours: 48,
      includeDataSnapshot: false,
    });

    expect(shareReq.expiresInHours).toBe(48);
    expect(shareReq.allowExport).toBe(true);
  });

  it('validates AskYourDataRequest and AskYourDataResponse', () => {
    const askReq = AskYourDataRequestSchema.parse({
      question: 'What was the top selling product category in Q2?',
      sheetName: 'Transactions',
      profiles: [
        {
          columnKey: 'category',
          originalName: 'Category',
          inferredType: 'category',
          semanticRole: 'dimension',
          nullable: false,
          nullCount: 0,
          totalCount: 10,
          distinctCount: 3,
          uniquenessRatio: 0.3,
          sampleValues: ['Electronics', 'Furniture'],
        },
      ],
    });

    expect(askReq.question).toContain('top selling product');

    const askRes = AskYourDataResponseSchema.parse({
      success: true,
      interpretedIntent: 'Aggregate total sales by category and sort descending.',
      sql: 'SELECT category, SUM(amount) AS total_sales FROM Transactions GROUP BY category ORDER BY total_sales DESC LIMIT 10;',
      explanation: 'Calculated the sum of amount per category for Q2.',
    });

    expect(askRes.success).toBe(true);
  });
});
