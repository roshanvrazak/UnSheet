import { describe, it, expect } from 'vitest';
import { detectHeaderRow } from '../../src/normalise/index.js';

describe('Header Detection', () => {
  it('detects standard header at row 0', () => {
    const grid = [
      ['Product ID', 'Category', 'Unit Price', 'Quantity In Stock'],
      [101, 'Hardware', 29.99, 150],
      [102, 'Software', 199.0, 50],
      [103, 'Hardware', 14.5, 300],
    ];

    const result = detectHeaderRow(grid);
    expect(result.detectedRowIndex).toBe(0);
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.originalHeaders).toEqual([
      'Product ID',
      'Category',
      'Unit Price',
      'Quantity In Stock',
    ]);
    expect(result.sanitizedKeys).toEqual([
      'product_id',
      'category',
      'unit_price',
      'quantity_in_stock',
    ]);
  });

  it('detects header when preceded by a title banner and spacer row', () => {
    const grid = [
      ['Acme Corp Q4 Operations Report', null, null, null], // Title banner
      [null, null, null, null], // Blank spacer
      ['Region', 'Manager', 'Quota', 'Actual'], // Actual header at row 2
      ['North', 'Alice', 100000, 120000],
      ['South', 'Bob', 90000, 85000],
      ['East', 'Charlie', 110000, 115000],
    ];

    const result = detectHeaderRow(grid);
    expect(result.detectedRowIndex).toBe(2);
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.originalHeaders).toEqual(['Region', 'Manager', 'Quota', 'Actual']);
    expect(result.sanitizedKeys).toEqual(['region', 'manager', 'quota', 'actual']);
  });

  it('supports header offsets up to row 20', () => {
    // Generate 15 spacer/note rows followed by a real header at row 15
    const grid: unknown[][] = [];
    for (let i = 0; i < 15; i++) {
      grid.push([`Note line ${i + 1}`, null, null]);
    }
    grid.push(['Employee ID', 'Full Name', 'Department']);
    grid.push([1, 'John Doe', 'Sales']);
    grid.push([2, 'Jane Smith', 'Engineering']);

    const result = detectHeaderRow(grid);
    expect(result.detectedRowIndex).toBe(15);
    expect(result.sanitizedKeys).toEqual(['employee_id', 'full_name', 'department']);
  });

  it('handles empty and single-cell grids gracefully', () => {
    const emptyResult = detectHeaderRow([]);
    expect(emptyResult.detectedRowIndex).toBe(0);
    expect(emptyResult.confidence).toBe(0);

    const singleCellResult = detectHeaderRow([['val']]);
    expect(singleCellResult.detectedRowIndex).toBe(0);
  });

  it('is idempotent on already-normalised data grids', () => {
    const grid = [
      ['col_a', 'col_b', 'col_c'],
      [1, 2, 3],
      [4, 5, 6],
    ];
    const firstPass = detectHeaderRow(grid);
    const secondPass = detectHeaderRow(grid);

    expect(firstPass.detectedRowIndex).toBe(secondPass.detectedRowIndex);
    expect(firstPass.sanitizedKeys).toEqual(secondPass.sanitizedKeys);
  });
});
