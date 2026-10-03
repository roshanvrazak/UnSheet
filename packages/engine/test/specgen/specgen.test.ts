import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DashboardSpecSchema,
  type SheetProfile,
  type WidgetGridPosition,
} from '@unsheet/contracts';
import { generateDashboardSpec, formatTitle } from '../../src/index.js';

function widgetsOverlap(a: WidgetGridPosition, b: WidgetGridPosition): boolean {
  const horizontalOverlap = a.x < b.x + b.w && a.x + a.w > b.x;
  const verticalOverlap = a.y < b.y + b.h && a.y + a.h > b.y;
  return horizontalOverlap && verticalOverlap;
}

describe('Spec Generation Engine Unit & Property Tests', () => {
  const baseProfile: SheetProfile = {
    sheetId: 'sheet_sales',
    sheetName: 'Quarterly Sales',
    rowCount: 100,
    columnProfiles: [
      {
        columnKey: 'order_id',
        originalName: 'Order ID',
        inferredType: 'id',
        semanticRole: 'identifier',
        nullable: false,
        nullCount: 0,
        totalCount: 100,
        distinctCount: 100,
        uniquenessRatio: 1.0,
        sampleValues: ['ORD-001', 'ORD-002'],
      },
      {
        columnKey: 'order_date',
        originalName: 'Order Date',
        inferredType: 'date',
        semanticRole: 'time',
        nullable: false,
        nullCount: 0,
        totalCount: 100,
        distinctCount: 50,
        uniquenessRatio: 0.5,
        sampleValues: ['2024-01-01', '2024-01-02'],
      },
      {
        columnKey: 'region',
        originalName: 'Region',
        inferredType: 'category',
        semanticRole: 'dimension',
        nullable: false,
        nullCount: 0,
        totalCount: 100,
        distinctCount: 4,
        uniquenessRatio: 0.04,
        topValues: [
          { value: 'North', count: 40, percentage: 40 },
          { value: 'South', count: 30, percentage: 30 },
          { value: 'East', count: 20, percentage: 20 },
          { value: 'West', count: 10, percentage: 10 },
        ],
        sampleValues: ['North', 'South'],
      },
      {
        columnKey: 'segment',
        originalName: 'Customer Segment',
        inferredType: 'category',
        semanticRole: 'dimension',
        nullable: false,
        nullCount: 0,
        totalCount: 100,
        distinctCount: 3,
        uniquenessRatio: 0.03,
        topValues: [
          { value: 'Consumer', count: 60, percentage: 60 },
          { value: 'Corporate', count: 30, percentage: 30 },
          { value: 'Home Office', count: 10, percentage: 10 },
        ],
        sampleValues: ['Consumer', 'Corporate'],
      },
      {
        columnKey: 'sales_amount',
        originalName: 'Sales Amount',
        inferredType: 'currency',
        semanticRole: 'measure',
        nullable: false,
        nullCount: 0,
        totalCount: 100,
        distinctCount: 85,
        uniquenessRatio: 0.85,
        currencyCode: 'USD',
        stats: {
          min: 10,
          max: 1500,
          sum: 45000,
          mean: 450,
          median: 400,
          variance: 25000,
          stdDev: 158.11,
        },
        sampleValues: ['150.00', '250.00'],
      },
      {
        columnKey: 'profit_margin',
        originalName: 'Profit Margin',
        inferredType: 'percent',
        semanticRole: 'measure',
        nullable: false,
        nullCount: 0,
        totalCount: 100,
        distinctCount: 40,
        uniquenessRatio: 0.4,
        stats: {
          min: 0.05,
          max: 0.45,
          sum: 22.5,
          mean: 0.225,
          median: 0.22,
          variance: 0.01,
          stdDev: 0.1,
        },
        sampleValues: ['15.0%', '22.0%'],
      },
    ],
    primaryKeyCandidate: 'order_id',
    recommendedDimensions: ['region', 'segment'],
    recommendedMeasures: ['sales_amount', 'profit_margin'],
    recommendedTimeColumn: 'order_date',
  };

  it('generates a valid DashboardSpec adhering to contracts', () => {
    const spec = generateDashboardSpec(baseProfile);

    // Validate with Zod schema
    const parsed = DashboardSpecSchema.parse(spec);
    expect(parsed.version).toBe('1.0');
    expect(parsed.sheetBinding).toBe('sheet_sales');
    expect(parsed.widgets.length).toBeGreaterThanOrEqual(4);
    expect(parsed.widgets.length).toBeLessThanOrEqual(50);
  });

  it('includes KPI cards for measures on row 0', () => {
    const spec = generateDashboardSpec(baseProfile);
    const kpis = spec.widgets.filter((w) => w.type === 'kpi');
    expect(kpis.length).toBe(2);

    expect(kpis[0]!.grid.y).toBe(0);
    expect(kpis[0]!.grid.x).toBe(0);
    expect(kpis[0]!.grid.w).toBe(6);

    expect(kpis[1]!.grid.y).toBe(0);
    expect(kpis[1]!.grid.x).toBe(6);
    expect(kpis[1]!.grid.w).toBe(6);
  });

  it('generates line chart, donut chart, pivot matrix, and record table', () => {
    const spec = generateDashboardSpec(baseProfile);

    const line = spec.widgets.find((w) => w.type === 'line');
    expect(line).toBeDefined();
    expect(line!.grid.w).toBe(8);

    const donut = spec.widgets.find((w) => w.type === 'donut');
    expect(donut).toBeDefined();
    expect(donut!.grid.w).toBe(4);
    expect(donut!.grid.x).toBe(8); // Side by side with line chart!

    const pivot = spec.widgets.find((w) => w.type === 'pivot');
    expect(pivot).toBeDefined();
    expect(pivot!.grid.w).toBe(12);

    const table = spec.widgets.find((w) => w.type === 'table');
    expect(table).toBeDefined();
    expect(table!.grid.w).toBe(12);
  });

  it('strictly enforces no overlapping widget bounds across all generated widgets', () => {
    const spec = generateDashboardSpec(baseProfile);

    for (let i = 0; i < spec.widgets.length; i++) {
      const widgetA = spec.widgets[i]!;
      expect(widgetA.grid.x + widgetA.grid.w).toBeLessThanOrEqual(12);
      expect(widgetA.grid.x).toBeGreaterThanOrEqual(0);
      expect(widgetA.grid.w).toBeGreaterThanOrEqual(1);

      for (let j = i + 1; j < spec.widgets.length; j++) {
        const widgetB = spec.widgets[j]!;
        const overlap = widgetsOverlap(widgetA.grid, widgetB.grid);
        expect(
          overlap,
          `Widget ${widgetA.id} (${JSON.stringify(widgetA.grid)}) overlaps with Widget ${widgetB.id} (${JSON.stringify(widgetB.grid)})`
        ).toBe(false);
      }
    }
  });

  it('generates fallback count KPI and table when dataset has no measures', () => {
    const noMeasuresProfile: SheetProfile = {
      sheetId: 'sheet_tags',
      sheetName: 'Tags',
      rowCount: 50,
      columnProfiles: [
        {
          columnKey: 'tag_id',
          originalName: 'Tag ID',
          inferredType: 'id',
          semanticRole: 'identifier',
          nullable: false,
          nullCount: 0,
          totalCount: 50,
          distinctCount: 50,
          uniquenessRatio: 1.0,
          sampleValues: ['TAG-01'],
        },
        {
          columnKey: 'tag_name',
          originalName: 'Tag Name',
          inferredType: 'text',
          semanticRole: 'dimension',
          nullable: false,
          nullCount: 0,
          totalCount: 50,
          distinctCount: 50,
          uniquenessRatio: 1.0,
          sampleValues: ['Alpha'],
        },
      ],
      primaryKeyCandidate: 'tag_id',
      recommendedDimensions: ['tag_name'],
      recommendedMeasures: [],
    };

    const spec = generateDashboardSpec(noMeasuresProfile);
    expect(DashboardSpecSchema.parse(spec)).toBeDefined();

    const kpi = spec.widgets.find((w) => w.type === 'kpi');
    expect(kpi).toBeDefined();
    expect(kpi!.aggregation).toBe('count');
  });

  it('formats titles cleanly', () => {
    expect(formatTitle('gross_revenue')).toBe('Gross Revenue');
    expect(formatTitle('customer_id')).toBe('Customer Id');
    expect(formatTitle('q1_figures_variance')).toBe('Q1 Figures Variance');
    expect(formatTitle('')).toBe('Item');
  });

  describe('Property-Based Invariant Testing (fast-check)', () => {
    it('arbitrary valid SheetProfile always generates a valid DashboardSpec without overlapping widgets', () => {
      const columnProfileArb = fc.record({
        columnKey: fc.stringMatching(/^[a-z][a-z0-9_]{1,15}$/),
        originalName: fc.string({ minLength: 1, maxLength: 30 }),
        inferredType: fc.constantFrom(
          'number',
          'currency',
          'percent',
          'date',
          'category',
          'id',
          'boolean',
          'text'
        ),
        semanticRole: fc.constantFrom('dimension', 'measure', 'time', 'identifier'),
        nullable: fc.boolean(),
        nullCount: fc.integer({ min: 0, max: 10 }),
        totalCount: fc.integer({ min: 10, max: 100 }),
        distinctCount: fc.integer({ min: 1, max: 50 }),
        uniquenessRatio: fc.float({ min: 0, max: 1 }),
        sampleValues: fc.constant(null).map((): string[] => ['sample_1', 'sample_2']),
      });

      const sheetProfileArb = fc
        .array(columnProfileArb, { minLength: 1, maxLength: 8 })
        .map((cols): SheetProfile => {
          // Ensure unique column keys
          const seen = new Set<string>();
          const dedupedCols = cols.filter((c) => {
            if (seen.has(c.columnKey)) return false;
            seen.add(c.columnKey);
            return true;
          });

          const timeCol = dedupedCols.find((c) => c.semanticRole === 'time')?.columnKey;
          const dimensions = dedupedCols
            .filter((c) => c.semanticRole === 'dimension')
            .map((c) => c.columnKey);
          const measures = dedupedCols
            .filter((c) => c.semanticRole === 'measure')
            .map((c) => c.columnKey);

          return {
            sheetId: 'sheet_arbitrary',
            sheetName: 'Arbitrary Sheet',
            rowCount: 50,
            columnProfiles: dedupedCols.length > 0 ? dedupedCols : [cols[0]!],
            ...(timeCol ? { recommendedTimeColumn: timeCol } : {}),
            recommendedDimensions: dimensions,
            recommendedMeasures: measures,
          };
        });

      fc.assert(
        fc.property(sheetProfileArb, (profile) => {
          const spec = generateDashboardSpec(profile);

          // 1. Must parse with contract schema
          DashboardSpecSchema.parse(spec);

          // 2. Must satisfy grid invariants
          for (let i = 0; i < spec.widgets.length; i++) {
            const wA = spec.widgets[i]!;
            expect(wA.grid.x + wA.grid.w).toBeLessThanOrEqual(12);
            expect(wA.grid.x).toBeGreaterThanOrEqual(0);
            expect(wA.grid.w).toBeGreaterThanOrEqual(1);

            for (let j = i + 1; j < spec.widgets.length; j++) {
              const wB = spec.widgets[j]!;
              const overlap = widgetsOverlap(wA.grid, wB.grid);
              expect(overlap).toBe(false);
            }
          }
        }),
        { numRuns: 50 }
      );
    });
  });
});
