import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SafeIdentifierSchema } from '@unsheet/contracts';
import {
  normaliseSheet,
  detectHeaderRow,
  sanitiseHeaders,
} from '../../src/index.js';

describe('Property-Based Invariants (fast-check)', () => {
  it('normaliseSheet never throws on arbitrary 2D grid inputs', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.array(
            fc.oneof(
              fc.string(),
              fc.integer(),
              fc.float({ noNaN: false }),
              fc.boolean(),
              fc.date(),
              fc.constant(null),
              fc.constant(undefined)
            ),
            { maxLength: 30 }
          ),
          { maxLength: 50 }
        ),
        (grid) => {
          const rawSheet = {
            name: 'ArbitrarySheet',
            grid,
            merges: [],
          };

          // Normaliser must never crash
          const sheetModel = normaliseSheet(rawSheet, 0);

          expect(sheetModel).toBeDefined();
          expect(sheetModel.columns.length).toBeGreaterThanOrEqual(1);
          expect(sheetModel.rowCount).toBe(sheetModel.rows.length);
          expect(sheetModel.columnCount).toBe(sheetModel.columns.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('output column keys are always pairwise unique and valid SafeIdentifiers', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 50 }),
        (headers) => {
          const keys = sanitiseHeaders(headers);

          // All keys must be unique
          const keySet = new Set(keys);
          expect(keySet.size).toBe(keys.length);

          // Every key must satisfy SafeIdentifierSchema
          for (const key of keys) {
            expect(SafeIdentifierSchema.safeParse(key).success).toBe(true);
            expect(['__proto__', 'constructor', 'prototype'].includes(key)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('normalisation row count never exceeds raw grid row count', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.array(fc.oneof(fc.string(), fc.integer(), fc.constant(null)), {
            minLength: 1,
            maxLength: 20,
          }),
          { minLength: 1, maxLength: 40 }
        ),
        (grid) => {
          const rawSheet = {
            name: 'RowCountCheck',
            grid,
            merges: [],
          };

          const sheetModel = normaliseSheet(rawSheet, 0);

          // Invariant: row count never increases during normalisation
          expect(sheetModel.rowCount).toBeLessThanOrEqual(grid.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('header detection is idempotent on the resulting table grid', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,20}$/),
          { minLength: 1, maxLength: 10 }
        ),
        fc.array(
          fc.array(fc.integer(), { minLength: 1, maxLength: 10 }),
          { minLength: 1, maxLength: 15 }
        ),
        (headers, rawData) => {
          // Normalize row widths to match headers
          const data = rawData.map((row) => {
            const padded = row.slice(0, headers.length);
            while (padded.length < headers.length) {
              padded.push(0);
            }
            return padded;
          });
          const grid: unknown[][] = [headers, ...data];

          const pass1 = detectHeaderRow(grid);
          const subgrid = grid.slice(pass1.detectedRowIndex);
          const pass2 = detectHeaderRow(subgrid);

          expect(pass2.detectedRowIndex).toBe(0);
          expect(pass2.sanitizedKeys).toEqual(pass1.sanitizedKeys);
        }
      ),
      { numRuns: 100 }
    );
  });
});
