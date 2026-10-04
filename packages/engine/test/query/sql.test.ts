import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type {
  AggregationFunction,
  QueryFilter,
  QueryFilterOperator,
  QueryPlan,
} from '@unsheet/contracts';
import {
  SafeSqlQuerySchema,
} from '@unsheet/contracts';
import {
  compileQueryPlanToSql,
  escapeSqlLiteral,
  quoteIdentifier,
} from '../../src/query/sql.js';

describe('SQL Compiler (compileQueryPlanToSql)', () => {
  describe('Identifier Quoting & Safety', () => {
    it('quotes valid identifiers with double quotes', () => {
      expect(quoteIdentifier('revenue')).toBe('"revenue"');
      expect(quoteIdentifier('order_date')).toBe('"order_date"');
      expect(quoteIdentifier('_private_col')).toBe('"_private_col"');
    });

    it('rejects identifiers with invalid characters or prototype keys', () => {
      expect(() => quoteIdentifier('hello world')).toThrow();
      expect(() => quoteIdentifier('123abc')).toThrow();
      expect(() => quoteIdentifier('__proto__')).toThrow();
      expect(() => quoteIdentifier('constructor')).toThrow();
    });
  });

  describe('Literal Escaping', () => {
    it('escapes primitives safely', () => {
      expect(escapeSqlLiteral(null)).toBe('NULL');
      expect(escapeSqlLiteral(undefined)).toBe('NULL');
      expect(escapeSqlLiteral(true)).toBe('TRUE');
      expect(escapeSqlLiteral(false)).toBe('FALSE');
      expect(escapeSqlLiteral(42)).toBe('42');
      expect(escapeSqlLiteral(3.1415)).toBe('3.1415');
      expect(escapeSqlLiteral("O'Reilly")).toBe("'O''Reilly'");
      expect(escapeSqlLiteral('normal_string')).toBe("'normal_string'");
      expect(escapeSqlLiteral(['a', "b'c"])).toBe("('a', 'b''c')");
    });

    it('rejects non-finite numbers', () => {
      expect(() => escapeSqlLiteral(NaN)).toThrow();
      expect(() => escapeSqlLiteral(Infinity)).toThrow();
      expect(() => escapeSqlLiteral(-Infinity)).toThrow();
    });
  });

  describe('Aggregation Compilation', () => {
    const aggFunctions: AggregationFunction[] = [
      'sum',
      'avg',
      'count',
      'min',
      'max',
      'distinctCount',
    ];

    it.each(aggFunctions)('compiles aggregation %s accurately', (fn) => {
      const plan: QueryPlan = {
        id: `plan_agg_${fn}`,
        table: 'sales',
        aggregations: [
          {
            columnKey: 'amount',
            function: fn,
            alias: `metric_${fn}`,
          },
        ],
      };

      const sql = compileQueryPlanToSql(plan);
      expect(() => SafeSqlQuerySchema.parse(sql)).not.toThrow();

      if (fn === 'distinctCount') {
        expect(sql).toContain('COUNT(DISTINCT "amount") AS "metric_distinctCount"');
      } else {
        expect(sql).toContain(`${fn.toUpperCase()}("amount") AS "metric_${fn}"`);
      }
    });
  });

  describe('Filter Operators Compilation', () => {
    const testCases: Array<{
      operator: QueryFilterOperator;
      value: unknown;
      expectedSnippet: string;
    }> = [
      { operator: 'eq', value: 'North', expectedSnippet: '"region" = \'North\'' },
      { operator: 'eq', value: null, expectedSnippet: '"region" IS NULL' },
      { operator: 'neq', value: 'South', expectedSnippet: '"region" != \'South\'' },
      { operator: 'neq', value: null, expectedSnippet: '"region" IS NOT NULL' },
      { operator: 'gt', value: 100, expectedSnippet: '"region" > 100' },
      { operator: 'gte', value: 50, expectedSnippet: '"region" >= 50' },
      { operator: 'lt', value: 200, expectedSnippet: '"region" < 200' },
      { operator: 'lte', value: 150, expectedSnippet: '"region" <= 150' },
      { operator: 'in', value: ['North', 'East'], expectedSnippet: '"region" IN (\'North\', \'East\')' },
      { operator: 'in', value: [], expectedSnippet: '1 = 0' },
      { operator: 'not_in', value: ['West'], expectedSnippet: '"region" NOT IN (\'West\')' },
      { operator: 'not_in', value: [], expectedSnippet: '1 = 1' },
      { operator: 'between', value: [10, 20], expectedSnippet: '"region" BETWEEN 10 AND 20' },
      { operator: 'contains', value: "test'value", expectedSnippet: '"region" LIKE \'%test\'\'value%\'' },
      { operator: 'starts_with', value: 'prefix', expectedSnippet: '"region" LIKE \'prefix%\'' },
      { operator: 'ends_with', value: 'suffix', expectedSnippet: '"region" LIKE \'%suffix\'' },
      { operator: 'is_null', value: undefined, expectedSnippet: '"region" IS NULL' },
      { operator: 'is_not_null', value: undefined, expectedSnippet: '"region" IS NOT NULL' },
    ];

    it.each(testCases)('compiles filter operator $operator accurately', ({ operator, value, expectedSnippet }) => {
      const filter: QueryFilter = {
        columnKey: 'region',
        operator,
        value: value as QueryFilter['value'],
      };

      const plan: QueryPlan = {
        id: `plan_filter_${operator}`,
        table: 'sales',
        select: ['region'],
        filters: [filter],
      };

      const sql = compileQueryPlanToSql(plan);
      expect(() => SafeSqlQuerySchema.parse(sql)).not.toThrow();
      expect(sql).toContain(expectedSnippet);
    });
  });

  describe('Complete SQL Statement Structures', () => {
    it('compiles multi-clause plan with dimensions, aggregations, filters, group by, order by, limit and offset', () => {
      const plan: QueryPlan = {
        id: 'plan_complex_1',
        table: 'orders',
        dimensions: ['category', 'region'],
        aggregations: [
          { columnKey: 'total_price', function: 'sum', alias: 'revenue' },
          { columnKey: 'order_id', function: 'distinctCount', alias: 'orders_count' },
        ],
        filters: [
          { columnKey: 'status', operator: 'eq', value: 'completed' },
          { columnKey: 'total_price', operator: 'gte', value: 50 },
        ],
        orderBy: [
          { columnKey: 'revenue', direction: 'desc' },
          { columnKey: 'category', direction: 'asc' },
        ],
        limit: 10,
        offset: 20,
      };

      const sql = compileQueryPlanToSql(plan);
      expect(() => SafeSqlQuerySchema.parse(sql)).not.toThrow();

      expect(sql).toBe(
        'SELECT "category", "region", SUM("total_price") AS "revenue", COUNT(DISTINCT "order_id") AS "orders_count" ' +
        'FROM "orders" ' +
        'WHERE "status" = \'completed\' AND "total_price" >= 50 ' +
        'GROUP BY "category", "region" ' +
        'ORDER BY "revenue" DESC, "category" ASC ' +
        'LIMIT 10 ' +
        'OFFSET 20'
      );
    });

    it('compiles simple select all when no select, dimensions, or aggregations specified', () => {
      const plan: QueryPlan = {
        id: 'plan_select_all',
        table: 'users',
      };

      const sql = compileQueryPlanToSql(plan);
      expect(sql).toBe('SELECT * FROM "users"');
      expect(() => SafeSqlQuerySchema.parse(sql)).not.toThrow();
    });
  });

  describe('Property-Based Testing (fast-check)', () => {
    const safeIdentArb = fc
      .stringMatching(/^[a-z][a-z0-9_]{0,15}$/)
      .filter((s) => !['drop', 'create', 'alter', 'insert', 'delete', 'table', 'from', 'select'].includes(s));

    const queryPlanArb: fc.Arbitrary<QueryPlan> = fc.record({
      id: fc.constant('test_query_plan'),
      table: safeIdentArb,
      dimensions: fc.option(fc.array(safeIdentArb, { minLength: 1, maxLength: 3 }), { nil: undefined }),
      aggregations: fc.option(
        fc.array(
          fc.record({
            columnKey: safeIdentArb,
            function: fc.constantFrom<AggregationFunction>(
              'sum',
              'avg',
              'count',
              'min',
              'max',
              'distinctCount'
            ),
            alias: safeIdentArb,
          }),
          { minLength: 1, maxLength: 3 }
        ),
        { nil: undefined }
      ),
      limit: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
      offset: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
    });

    it('asserts any valid generated QueryPlan compiles to a SQL string satisfying SafeSqlQuerySchema', () => {
      fc.assert(
        fc.property(queryPlanArb, (plan) => {
          const sql = compileQueryPlanToSql(plan);
          const parsed = SafeSqlQuerySchema.safeParse(sql);
          expect(parsed.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
});
