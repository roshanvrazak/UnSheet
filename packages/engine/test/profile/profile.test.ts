import { describe, expect, it } from 'vitest';
import {
  CategoryFrequencySchema,
  SampleValuesArraySchema,
  SheetModelSchema,
  type SheetModel,
  type WorkbookModel,
} from '@unsheet/contracts';
import {
  assignSemanticRole,
  computeColumnStats,
  extractStem,
  areNamesCompatible,
  parseNumericValue,
  profileSheet,
  profileWorkbook,
  sanitizeCategoryValue,
  sanitizeSampleValue,
} from '../../src/index.js';

describe('Profile Module Unit Tests', () => {
  describe('Formula Injection Sanitization', () => {
    it('sanitizes formula triggers in sample values with prefixing and truncation', () => {
      const hostileValues = [
        '=SUM(A1:A10)',
        '+12345',
        '-42',
        '@cmd|calc.exe',
        '\tTAB_INDENT',
        '\r\nLINE_BREAK',
        '|PIPE_SEPARATION',
        '   =TRIMMED_TRIGGER',
        'Normal Value',
        'A'.repeat(50),
      ];

      for (const raw of hostileValues) {
        const sanitized = sanitizeSampleValue(raw);
        expect(sanitized.length).toBeLessThanOrEqual(40);
        // Must safely parse with SampleValueSchema
        const parsed = SampleValuesArraySchema.element.safeParse(sanitized);
        expect(parsed.success).toBe(true);
      }
    });

    it('handles null and empty sample values gracefully', () => {
      expect(sanitizeSampleValue(null)).toBe('');
      expect(sanitizeSampleValue(undefined)).toBe('');
      expect(sanitizeSampleValue('')).toBe('');
      expect(sanitizeSampleValue('   ')).toBe('');
    });

    it('sanitizes formula triggers in category frequencies', () => {
      const hostileCategories = [
        '=HYPERLINK("http://evil.com")',
        '+100',
        '-SUBTOTAL',
        '@EVIL',
        '|COMMAND',
        '   -TRIMMED_MINUS',
      ];

      for (const raw of hostileCategories) {
        const sanitized = sanitizeCategoryValue(raw);
        expect(sanitized.length).toBeLessThanOrEqual(100);
        const parsed = CategoryFrequencySchema.shape.value.safeParse(sanitized);
        expect(parsed.success).toBe(true);
      }

      expect(sanitizeCategoryValue(null)).toBe('null');
      expect(sanitizeCategoryValue('')).toBe('(empty)');
    });
  });

  describe('Numeric Value Parser', () => {
    it('parses positive, negative, and accounting parentheses correctly', () => {
      expect(parseNumericValue('123')).toBe(123);
      expect(parseNumericValue('-456.78')).toBe(-456.78);
      expect(parseNumericValue('+789')).toBe(789);
      expect(parseNumericValue('(1,234.50)')).toBe(-1234.5);
      expect(parseNumericValue('($5,000.00)')).toBe(-5000);
      expect(parseNumericValue('€ 250.75')).toBe(250.75);
      expect(parseNumericValue('15.5%')).toBe(15.5);
      expect(parseNumericValue(42)).toBe(42);
      expect(parseNumericValue(null)).toBeNull();
      expect(parseNumericValue('invalid')).toBeNull();
      expect(parseNumericValue(NaN)).toBeNull();
      expect(parseNumericValue(Infinity)).toBeNull();
    });
  });

  describe('Statistics Computation', () => {
    it('computes exact finite stats for numeric columns', () => {
      const values = [10, 20, 30, 40, 50];
      const result = computeColumnStats(values, 'number');

      expect(result.totalCount).toBe(5);
      expect(result.nullCount).toBe(0);
      expect(result.nullable).toBe(false);
      expect(result.distinctCount).toBe(5);
      expect(result.uniquenessRatio).toBe(1.0);

      expect(result.stats).toBeDefined();
      expect(result.stats!.min).toBe(10);
      expect(result.stats!.max).toBe(50);
      expect(result.stats!.sum).toBe(150);
      expect(result.stats!.mean).toBe(30);
      expect(result.stats!.median).toBe(30);
      expect(result.stats!.variance).toBe(200);
      expect(result.stats!.stdDev).toBeCloseTo(Math.sqrt(200), 5);
    });

    it('computes median for even number of items', () => {
      const values = [10, 20, 30, 40];
      const result = computeColumnStats(values, 'number');
      expect(result.stats!.median).toBe(25);
    });

    it('computes frequency breakdown for category columns', () => {
      const values = ['Apple', 'Banana', 'Apple', 'Orange', 'Apple', 'Banana', null];
      const result = computeColumnStats(values, 'category');

      expect(result.totalCount).toBe(7);
      expect(result.nullCount).toBe(1);
      expect(result.nullable).toBe(true);
      expect(result.distinctCount).toBe(3);

      expect(result.topValues).toBeDefined();
      expect(result.topValues![0]!.value).toBe('Apple');
      expect(result.topValues![0]!.count).toBe(3);
      expect(result.topValues![0]!.percentage).toBeCloseTo((3 / 7) * 100, 1);
    });
  });

  describe('Semantic Role Assignment', () => {
    it('assigns time role to dates and temporal names', () => {
      expect(
        assignSemanticRole({
          key: 'created_at',
          inferredType: 'date',
          uniquenessRatio: 0.9,
          distinctCount: 9,
          totalCount: 10,
        })
      ).toBe('time');

      expect(
        assignSemanticRole({
          key: 'fiscal_year',
          inferredType: 'number',
          uniquenessRatio: 0.2,
          distinctCount: 2,
          totalCount: 10,
        })
      ).toBe('time');
    });

    it('assigns identifier role to IDs and high uniqueness keys', () => {
      expect(
        assignSemanticRole({
          key: 'customer_id',
          inferredType: 'id',
          uniquenessRatio: 1.0,
          distinctCount: 10,
          totalCount: 10,
        })
      ).toBe('identifier');

      expect(
        assignSemanticRole({
          key: 'order_ref',
          inferredType: 'text',
          uniquenessRatio: 1.0,
          distinctCount: 10,
          totalCount: 10,
        })
      ).toBe('identifier');
    });

    it('assigns measure role to continuous numeric metrics', () => {
      expect(
        assignSemanticRole({
          key: 'sales_amount',
          inferredType: 'currency',
          uniquenessRatio: 0.8,
          distinctCount: 8,
          totalCount: 10,
        })
      ).toBe('measure');

      expect(
        assignSemanticRole({
          key: 'discount_rate',
          inferredType: 'percent',
          uniquenessRatio: 0.5,
          distinctCount: 5,
          totalCount: 10,
        })
      ).toBe('measure');
    });

    it('assigns dimension role to categoricals and booleans', () => {
      expect(
        assignSemanticRole({
          key: 'status',
          inferredType: 'category',
          uniquenessRatio: 0.3,
          distinctCount: 3,
          totalCount: 10,
        })
      ).toBe('dimension');

      expect(
        assignSemanticRole({
          key: 'is_active',
          inferredType: 'boolean',
          uniquenessRatio: 0.2,
          distinctCount: 2,
          totalCount: 10,
        })
      ).toBe('dimension');
    });
  });

  describe('Join Stems & Matching', () => {
    it('correctly extracts semantic stems', () => {
      expect(extractStem('customer_id')).toBe('customer');
      expect(extractStem('order_code')).toBe('order');
      expect(extractStem('account_no')).toBe('account');
      expect(extractStem('item_ref')).toBe('item');
    });

    it('detects naming compatibility', () => {
      expect(areNamesCompatible('customer_id', 'customer_id')).toBe(true);
      expect(areNamesCompatible('customer_id', 'id')).toBe(true);
      expect(areNamesCompatible('id', 'order_id')).toBe(true);
      expect(areNamesCompatible('emp_code', 'emp_code')).toBe(true);
      expect(areNamesCompatible('total_revenue', 'product_name')).toBe(false);
    });
  });

  describe('Sheet & Workbook Profilers', () => {
    const testSheet: SheetModel = SheetModelSchema.parse({
      id: 'sheet_01',
      name: 'Sales_Data',
      headers: {
        detectedRowIndex: 0,
        confidence: 1.0,
        originalHeaders: ['Order ID', 'Order Date', 'Customer', 'Category', 'Revenue', 'Is Returned'],
        sanitizedKeys: ['order_id', 'order_date', 'customer', 'category', 'revenue', 'is_returned'],
      },
      columns: [
        { key: 'order_id', originalName: 'Order ID', columnIndex: 0 },
        { key: 'order_date', originalName: 'Order Date', columnIndex: 1 },
        { key: 'customer', originalName: 'Customer', columnIndex: 2 },
        { key: 'category', originalName: 'Category', columnIndex: 3 },
        { key: 'revenue', originalName: 'Revenue', columnIndex: 4 },
        { key: 'is_returned', originalName: 'Is Returned', columnIndex: 5 },
      ],
      rows: [
        { order_id: 'ORD-001', order_date: '2024-01-01', customer: 'Acme Corp', category: 'Software', revenue: 1500, is_returned: false },
        { order_id: 'ORD-002', order_date: '2024-01-02', customer: 'Beta LLC', category: 'Hardware', revenue: 3200, is_returned: true },
        { order_id: 'ORD-003', order_date: '2024-01-03', customer: 'Gamma Inc', category: 'Software', revenue: 950, is_returned: false },
      ],
      rowCount: 3,
      columnCount: 6,
    });

    it('generates a valid SheetProfile conforming to contracts', () => {
      const profile = profileSheet(testSheet);

      expect(profile.sheetId).toBe('sheet_01');
      expect(profile.sheetName).toBe('Sales_Data');
      expect(profile.primaryKeyCandidate).toBe('order_id');
      expect(profile.recommendedTimeColumn).toBe('order_date');
      expect(profile.recommendedMeasures).toContain('revenue');
      expect(profile.recommendedDimensions).toContain('category');
      expect(profile.columnProfiles.length).toBe(6);
    });

    it('generates a valid WorkbookProfile with join candidates', () => {
      const customersSheet: SheetModel = SheetModelSchema.parse({
        id: 'sheet_cust',
        name: 'Customers',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: ['Customer ID', 'Customer Name'],
          sanitizedKeys: ['customer_id', 'customer_name'],
        },
        columns: [
          { key: 'customer_id', originalName: 'Customer ID', columnIndex: 0 },
          { key: 'customer_name', originalName: 'Customer Name', columnIndex: 1 },
        ],
        rows: [
          { customer_id: 'C-01', customer_name: 'Acme Corp' },
          { customer_id: 'C-02', customer_name: 'Beta LLC' },
        ],
        rowCount: 2,
        columnCount: 2,
      });

      const ordersSheet: SheetModel = SheetModelSchema.parse({
        id: 'sheet_ord',
        name: 'Orders',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: ['Order ID', 'Customer ID', 'Amount'],
          sanitizedKeys: ['order_id', 'customer_id', 'amount'],
        },
        columns: [
          { key: 'order_id', originalName: 'Order ID', columnIndex: 0 },
          { key: 'customer_id', originalName: 'Customer ID', columnIndex: 1 },
          { key: 'amount', originalName: 'Amount', columnIndex: 2 },
        ],
        rows: [
          { order_id: 'ORD-1', customer_id: 'C-01', amount: 500 },
          { order_id: 'ORD-2', customer_id: 'C-02', amount: 800 },
        ],
        rowCount: 2,
        columnCount: 3,
      });

      const workbook: WorkbookModel = {
        id: 'wb_01',
        filename: 'Sales.xlsx',
        fileSize: 4096,
        sheets: [customersSheet, ordersSheet],
        activeSheetIndex: 0,
      };

      const wbProfile = profileWorkbook(workbook);
      expect(wbProfile.sheets.length).toBe(2);
      expect(wbProfile.crossSheetJoins.length).toBeGreaterThanOrEqual(1);

      const join = wbProfile.crossSheetJoins.find(
        (j) => j.sourceColumn === 'customer_id' && j.targetColumn === 'customer_id'
      );
      expect(join).toBeDefined();
      expect(join!.overlapRatio).toBe(1.0);
    });
  });
});
