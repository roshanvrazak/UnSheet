import { describe, it, expect } from 'vitest';
import type {
  QueryPlan,
  SheetModel,
  SheetProfile,
} from '@unsheet/contracts';
import { validateQueryPlanAgainstSheet } from '../../src/query/validation.js';

const mockSheet: SheetModel = {
  id: 'sheet_main',
  name: 'sales_records',
  headers: {
    detectedRowIndex: 0,
    confidence: 1,
    originalHeaders: ['Region', 'Amount', 'Status'],
    sanitizedKeys: ['region', 'amount', 'status'],
  },
  columns: [
    { key: 'region', originalName: 'Region', columnIndex: 0 },
    { key: 'amount', originalName: 'Amount', columnIndex: 1 },
    { key: 'status', originalName: 'Status', columnIndex: 2 },
  ],
  rows: [
    { region: 'North', amount: 100, status: 'active' },
  ],
  rowCount: 1,
  columnCount: 3,
};

const mockProfile: SheetProfile = {
  sheetId: 'sheet_main',
  sheetName: 'sales_records',
  rowCount: 1,
  columnProfiles: [
    {
      columnKey: 'region',
      originalName: 'Region',
      inferredType: 'category',
      semanticRole: 'dimension',
      nullable: false,
      nullCount: 0,
      totalCount: 1,
      distinctCount: 1,
      uniquenessRatio: 1,
      sampleValues: ['North'],
    },
    {
      columnKey: 'amount',
      originalName: 'Amount',
      inferredType: 'number',
      semanticRole: 'measure',
      nullable: false,
      nullCount: 0,
      totalCount: 1,
      distinctCount: 1,
      uniquenessRatio: 1,
      sampleValues: ['100'],
    },
  ],
  recommendedDimensions: ['region'],
  recommendedMeasures: ['amount'],
};

describe('AST & Allowlist Validation (validateQueryPlanAgainstSheet)', () => {
  it('passes a fully valid QueryPlan against SheetModel', () => {
    const validPlan: QueryPlan = {
      id: 'plan_valid',
      table: 'sales_records',
      dimensions: ['region'],
      aggregations: [
        { columnKey: 'amount', function: 'sum', alias: 'total_amount' },
      ],
      filters: [
        { columnKey: 'status', operator: 'eq', value: 'active' },
      ],
      orderBy: [
        { columnKey: 'total_amount', direction: 'desc' },
      ],
      limit: 10,
      offset: 0,
    };

    const result = validateQueryPlanAgainstSheet(validPlan, mockSheet);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('passes a valid QueryPlan against SheetProfile', () => {
    const validPlan: QueryPlan = {
      id: 'plan_valid_profile',
      table: 'sales_records',
      dimensions: ['region'],
      aggregations: [
        { columnKey: 'amount', function: 'avg', alias: 'avg_amount' },
      ],
    };

    const result = validateQueryPlanAgainstSheet(validPlan, mockProfile);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects unallowlisted tables', () => {
    const invalidTablePlan: QueryPlan = {
      id: 'plan_bad_table',
      table: 'secret_passwords',
      select: ['region'],
    };

    const result = validateQueryPlanAgainstSheet(invalidTablePlan, mockSheet);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('not allowlisted for the specified sheet'))).toBe(true);
  });

  it('rejects unallowlisted columns in select', () => {
    const badSelectPlan: QueryPlan = {
      id: 'plan_bad_select',
      table: 'sales_records',
      select: ['region', 'password_hash'],
    };

    const result = validateQueryPlanAgainstSheet(badSelectPlan, mockSheet);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Select column "password_hash" is not allowlisted'))).toBe(true);
  });

  it('rejects unallowlisted columns in dimensions and aggregations', () => {
    const badDimsPlan: QueryPlan = {
      id: 'plan_bad_dim',
      table: 'sales_records',
      dimensions: ['unknown_dimension'],
      aggregations: [
        { columnKey: 'unknown_measure', function: 'sum', alias: 'revenue' },
      ],
    };

    const result = validateQueryPlanAgainstSheet(badDimsPlan, mockSheet);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Dimension column "unknown_dimension"'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Aggregation column "unknown_measure"'))).toBe(true);
  });

  it('rejects unallowlisted columns in filters', () => {
    const badFilterPlan: QueryPlan = {
      id: 'plan_bad_filter',
      table: 'sales_records',
      filters: [
        { columnKey: 'is_admin', operator: 'eq', value: true },
      ],
    };

    const result = validateQueryPlanAgainstSheet(badFilterPlan, mockSheet);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Filter column "is_admin"'))).toBe(true);
  });

  it('rejects unallowlisted columns in orderBy when not in sheet and not in aggregation aliases', () => {
    const badOrderPlan: QueryPlan = {
      id: 'plan_bad_order',
      table: 'sales_records',
      orderBy: [
        { columnKey: 'unrelated_col', direction: 'asc' },
      ],
    };

    const result = validateQueryPlanAgainstSheet(badOrderPlan, mockSheet);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('OrderBy column "unrelated_col"'))).toBe(true);
  });

  it('permits aggregation alias in orderBy', () => {
    const aliasOrderPlan: QueryPlan = {
      id: 'plan_alias_order',
      table: 'sales_records',
      aggregations: [
        { columnKey: 'amount', function: 'sum', alias: 'total_rev' },
      ],
      orderBy: [
        { columnKey: 'total_rev', direction: 'desc' },
      ],
    };

    const result = validateQueryPlanAgainstSheet(aliasOrderPlan, mockSheet);
    expect(result.valid).toBe(true);
  });

  it('rejects forbidden SQL keywords used as identifiers', () => {
    const forbiddenPlan: QueryPlan = {
      id: 'plan_forbidden',
      table: 'DROP',
      select: ['region'],
    };

    const result = validateQueryPlanAgainstSheet(forbiddenPlan, mockSheet);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('matches forbidden SQL keyword'))).toBe(true);
  });

  it('rejects out of bounds limit and negative offset', () => {
    const invalidBoundsPlan: QueryPlan = {
      id: 'plan_bounds',
      table: 'sales_records',
      select: ['region'],
      limit: 60000,
      offset: -5,
    };

    const result = validateQueryPlanAgainstSheet(invalidBoundsPlan, mockSheet);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Limit must be a positive integer and <= 50000'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Offset must be a non-negative integer'))).toBe(true);
  });
});
