import { describe, it, expect } from 'vitest';
import { applyMergeForwardFill } from '../../src/normalise/index.js';

describe('Merge Forward Fill', () => {
  it('returns original grid if merges list is empty', () => {
    const grid = [
      ['A', 'B'],
      [1, 2],
    ];
    const result = applyMergeForwardFill(grid, []);
    expect(result).toEqual(grid);
  });

  it('forward-fills horizontal merged cells', () => {
    const grid = [
      ['Quarter 1', null, null, 'Quarter 2', null],
      [10, 20, 30, 40, 50],
    ];
    const merges = [
      { startRow: 0, startCol: 0, endRow: 0, endCol: 2 }, // Q1 over cols 0..2
      { startRow: 0, startCol: 3, endRow: 0, endCol: 4 }, // Q2 over cols 3..4
    ];

    const result = applyMergeForwardFill(grid, merges);
    expect(result[0]).toEqual([
      'Quarter 1',
      'Quarter 1',
      'Quarter 1',
      'Quarter 2',
      'Quarter 2',
    ]);
    expect(result[1]).toEqual([10, 20, 30, 40, 50]);
  });

  it('forward-fills vertical merged cells', () => {
    const grid = [
      ['Category A', 10],
      [null, 20],
      [null, 30],
    ];
    const merges = [{ startRow: 0, startCol: 0, endRow: 2, endCol: 0 }];

    const result = applyMergeForwardFill(grid, merges);
    expect(result[0]?.[0]).toBe('Category A');
    expect(result[1]?.[0]).toBe('Category A');
    expect(result[2]?.[0]).toBe('Category A');
  });

  it('forward-fills 2D block merges', () => {
    const grid = [
      ['BlockHeader', null, 'Other'],
      [null, null, 'Other2'],
      ['Data1', 'Data2', 'Data3'],
    ];
    const merges = [{ startRow: 0, startCol: 0, endRow: 1, endCol: 1 }];

    const result = applyMergeForwardFill(grid, merges);
    expect(result[0]?.[0]).toBe('BlockHeader');
    expect(result[0]?.[1]).toBe('BlockHeader');
    expect(result[1]?.[0]).toBe('BlockHeader');
    expect(result[1]?.[1]).toBe('BlockHeader');
    expect(result[2]?.[0]).toBe('Data1');
  });

  it('gracefully handles out-of-bounds merges without throwing', () => {
    const grid = [['A', 'B']];
    const outOfBoundsMerges = [
      { startRow: 10, startCol: 10, endRow: 20, endCol: 20 },
      { startRow: 0, startCol: 5, endRow: 0, endCol: 10 },
    ];
    expect(() => applyMergeForwardFill(grid, outOfBoundsMerges)).not.toThrow();
  });
});
