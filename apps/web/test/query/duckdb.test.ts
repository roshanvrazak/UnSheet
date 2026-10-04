import { describe, it, expect } from 'vitest';
import * as arrow from 'apache-arrow';
import { QueryResultSchema } from '@unsheet/contracts';
import {
  arrowTableToQueryResult,
  getDuckDB,
  DuckDBManager,
} from '../../lib/query/duckdb.js';

describe('DuckDB-WASM Browser Integration', () => {
  describe('arrowTableToQueryResult', () => {
    it('accurately converts Apache Arrow tables into validated QueryResult objects', () => {
      const arrowTable = arrow.tableFromJSON([
        { id: 1, name: 'Alice', score: 95.5 },
        { id: 2, name: 'Bob', score: 88.0 },
      ]);

      const result = arrowTableToQueryResult(arrowTable, 'test_query_1', 12.5);
      expect(() => QueryResultSchema.parse(result)).not.toThrow();

      expect(result.queryId).toBe('test_query_1');
      expect(result.rowCount).toBe(2);
      expect(result.executionTimeMs).toBe(12.5);
      expect(result.rows).toEqual([
        { id: 1, name: 'Alice', score: 95.5 },
        { id: 2, name: 'Bob', score: 88.0 },
      ]);
      expect(result.columns.map((c) => c.name)).toEqual(['id', 'name', 'score']);
    });

    it('safely converts BigInt values to JavaScript numbers to prevent serialization failure', () => {
      const arrowTable = arrow.tableFromJSON([
        { count: 100n, label: 'sample' },
      ]);

      const result = arrowTableToQueryResult(arrowTable, 'test_bigint');
      expect(() => QueryResultSchema.parse(result)).not.toThrow();

      expect(result.rows[0]?.count).toBe(100);
      expect(typeof result.rows[0]?.count).toBe('number');
    });
  });

  describe('Browser Environment Guard', () => {
    it('throws when getDuckDB is invoked in a non-browser environment without window', async () => {
      await expect(getDuckDB()).rejects.toThrow(
        /DuckDB-WASM can only be initialized in a browser environment/
      );
    });

    it('exposes DuckDBManager singleton object with expected API', () => {
      expect(typeof DuckDBManager.getInstance).toBe('function');
      expect(typeof DuckDBManager.registerSheetTable).toBe('function');
      expect(typeof DuckDBManager.executeQuery).toBe('function');
      expect(typeof DuckDBManager.reset).toBe('function');
      expect(typeof DuckDBManager.arrowTableToQueryResult).toBe('function');
    });
  });
});
