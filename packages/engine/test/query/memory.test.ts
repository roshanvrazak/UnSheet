import { describe, it, expect } from 'vitest';
import type { QueryPlan, SheetModel } from '@unsheet/contracts';
import { QueryResultSchema } from '@unsheet/contracts';
import { executeQueryInMemory } from '../../src/query/memory.js';

const fixtureSheet: SheetModel = {
  id: 'fixture_sales',
  name: 'sales',
  headers: {
    detectedRowIndex: 0,
    confidence: 1,
    originalHeaders: ['Region', 'Category', 'Sales', 'Profit', 'Units'],
    sanitizedKeys: ['region', 'category', 'sales', 'profit', 'units'],
  },
  columns: [
    { key: 'region', originalName: 'Region', columnIndex: 0 },
    { key: 'category', originalName: 'Category', columnIndex: 1 },
    { key: 'sales', originalName: 'Sales', columnIndex: 2 },
    { key: 'profit', originalName: 'Profit', columnIndex: 3 },
    { key: 'units', originalName: 'Units', columnIndex: 4 },
  ],
  rows: [
    { region: 'East', category: 'Tech', sales: 100, profit: 20, units: 2 },
    { region: 'East', category: 'Office', sales: 200, profit: 40, units: 5 },
    { region: 'West', category: 'Tech', sales: 300, profit: -10, units: 3 },
    { region: 'West', category: 'Office', sales: 400, profit: 80, units: 10 },
    { region: 'North', category: 'Furniture', sales: 150, profit: 15, units: 1 },
    { region: 'South', category: null, sales: 50, profit: null, units: 1 },
  ],
  rowCount: 6,
  columnCount: 5,
};

describe('In-Memory Query Execution Engine (executeQueryInMemory)', () => {
  describe('Global Aggregations (KPI style)', () => {
    it('accurately computes sum, avg, min, max, count, and distinctCount', () => {
      const plan: QueryPlan = {
        id: 'plan_kpi_all_aggs',
        table: 'sales',
        aggregations: [
          { columnKey: 'sales', function: 'sum', alias: 'total_sales' },
          { columnKey: 'sales', function: 'avg', alias: 'avg_sales' },
          { columnKey: 'profit', function: 'min', alias: 'min_profit' },
          { columnKey: 'profit', function: 'max', alias: 'max_profit' },
          { columnKey: 'sales', function: 'count', alias: 'sales_count' },
          { columnKey: 'category', function: 'distinctCount', alias: 'distinct_categories' },
        ],
      };

      const result = executeQueryInMemory(plan, fixtureSheet);
      expect(() => QueryResultSchema.parse(result)).not.toThrow();

      expect(result.rowCount).toBe(1);
      const row = result.rows[0]!;

      // 100 + 200 + 300 + 400 + 150 + 50 = 1200
      expect(row.total_sales).toBe(1200);
      // 1200 / 6 = 200
      expect(row.avg_sales).toBe(200);
      // profit non-nulls: [20, 40, -10, 80, 15] -> min is -10
      expect(row.min_profit).toBe(-10);
      // max is 80
      expect(row.max_profit).toBe(80);
      // count of non-null sales: 6
      expect(row.sales_count).toBe(6);
      // distinct categories: ['Tech', 'Office', 'Furniture'] = 3 (null is filtered out)
      expect(row.distinct_categories).toBe(3);
    });
  });

  describe('Dimension Grouping (Bar / Line / Donut style)', () => {
    it('groups by single dimension and computes grouped aggregations with ordering', () => {
      const plan: QueryPlan = {
        id: 'plan_grouped_region',
        table: 'sales',
        dimensions: ['region'],
        aggregations: [
          { columnKey: 'sales', function: 'sum', alias: 'region_sales' },
        ],
        orderBy: [
          { columnKey: 'region_sales', direction: 'desc' },
        ],
      };

      const result = executeQueryInMemory(plan, fixtureSheet);
      expect(() => QueryResultSchema.parse(result)).not.toThrow();

      // Regions:
      // West: 300 + 400 = 700
      // East: 100 + 200 = 300
      // North: 150
      // South: 50
      expect(result.rowCount).toBe(4);
      expect(result.rows).toEqual([
        { region: 'West', region_sales: 700 },
        { region: 'East', region_sales: 300 },
        { region: 'North', region_sales: 150 },
        { region: 'South', region_sales: 50 },
      ]);
    });

    it('groups by multiple dimensions (pivot style)', () => {
      const plan: QueryPlan = {
        id: 'plan_multi_group',
        table: 'sales',
        dimensions: ['region', 'category'],
        aggregations: [
          { columnKey: 'units', function: 'sum', alias: 'total_units' },
        ],
        orderBy: [
          { columnKey: 'region', direction: 'asc' },
          { columnKey: 'category', direction: 'asc' },
        ],
      };

      const result = executeQueryInMemory(plan, fixtureSheet);
      expect(() => QueryResultSchema.parse(result)).not.toThrow();

      const eastOffice = result.rows.find((r) => r.region === 'East' && r.category === 'Office');
      expect(eastOffice?.total_units).toBe(5);

      const westTech = result.rows.find((r) => r.region === 'West' && r.category === 'Tech');
      expect(westTech?.total_units).toBe(3);
    });
  });

  describe('Filtering Accuracy', () => {
    it('applies eq and gt filters correctly', () => {
      const plan: QueryPlan = {
        id: 'plan_filter_eq_gt',
        table: 'sales',
        select: ['region', 'sales'],
        filters: [
          { columnKey: 'region', operator: 'eq', value: 'East' },
          { columnKey: 'sales', operator: 'gt', value: 150 },
        ],
      };

      const result = executeQueryInMemory(plan, fixtureSheet);
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toEqual({ region: 'East', sales: 200 });
    });

    it('applies between filter correctly', () => {
      const plan: QueryPlan = {
        id: 'plan_filter_between',
        table: 'sales',
        select: ['sales'],
        filters: [
          { columnKey: 'sales', operator: 'between', value: [100, 250] },
        ],
        orderBy: [{ columnKey: 'sales', direction: 'asc' }],
      };

      const result = executeQueryInMemory(plan, fixtureSheet);
      // 100, 200, 150 fall into [100, 250]
      expect(result.rowCount).toBe(3);
      expect(result.rows.map((r) => r.sales)).toEqual([100, 150, 200]);
    });

    it('applies in and not_in filters correctly', () => {
      const plan: QueryPlan = {
        id: 'plan_filter_in',
        table: 'sales',
        select: ['region'],
        filters: [
          { columnKey: 'region', operator: 'in', value: ['East', 'West'] },
          { columnKey: 'category', operator: 'not_in', value: ['Tech'] },
        ],
      };

      const result = executeQueryInMemory(plan, fixtureSheet);
      // East (Office), West (Office)
      expect(result.rowCount).toBe(2);
      expect(result.rows.map((r) => r.region)).toEqual(['East', 'West']);
    });

    it('applies contains, starts_with, ends_with string filters', () => {
      const plan: QueryPlan = {
        id: 'plan_filter_string_ops',
        table: 'sales',
        select: ['category'],
        filters: [
          { columnKey: 'category', operator: 'contains', value: 'rn' }, // Furniture
        ],
      };

      const result = executeQueryInMemory(plan, fixtureSheet);
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]?.category).toBe('Furniture');
    });

    it('applies is_null and is_not_null filters', () => {
      const planNull: QueryPlan = {
        id: 'plan_is_null',
        table: 'sales',
        select: ['region'],
        filters: [{ columnKey: 'category', operator: 'is_null' }],
      };
      const resultNull = executeQueryInMemory(planNull, fixtureSheet);
      expect(resultNull.rowCount).toBe(1);
      expect(resultNull.rows[0]?.region).toBe('South');

      const planNotNull: QueryPlan = {
        id: 'plan_is_not_null',
        table: 'sales',
        select: ['region'],
        filters: [{ columnKey: 'category', operator: 'is_not_null' }],
      };
      const resultNotNull = executeQueryInMemory(planNotNull, fixtureSheet);
      expect(resultNotNull.rowCount).toBe(5);
    });
  });

  describe('Pagination (limit & offset)', () => {
    it('honors limit and offset parameters', () => {
      const plan: QueryPlan = {
        id: 'plan_pagination',
        table: 'sales',
        select: ['sales'],
        orderBy: [{ columnKey: 'sales', direction: 'asc' }],
        limit: 2,
        offset: 2,
      };

      // Full sorted sales: [50, 100, 150, 200, 300, 400]
      // Offset 2, limit 2: [150, 200]
      const result = executeQueryInMemory(plan, fixtureSheet);
      expect(result.rowCount).toBe(2);
      expect(result.rows.map((r) => r.sales)).toEqual([150, 200]);
    });
  });

  describe('Validation & Error handling', () => {
    it('throws when plan refers to non-existent columns', () => {
      const badPlan: QueryPlan = {
        id: 'plan_bad',
        table: 'sales',
        select: ['fake_column'],
      };

      expect(() => executeQueryInMemory(badPlan, fixtureSheet)).toThrow(
        /Query plan validation failed/
      );
    });
  });
});
