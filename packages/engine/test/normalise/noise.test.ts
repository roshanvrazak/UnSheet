import { describe, it, expect } from 'vitest';
import {
  isEmptySpacerRow,
  isSubtotalRow,
  isFootnoteRow,
  removeNoiseRows,
} from '../../src/normalise/index.js';

describe('Noise Removal', () => {
  describe('isEmptySpacerRow', () => {
    it('identifies rows with nulls, undefined, and empty strings as empty', () => {
      expect(isEmptySpacerRow([])).toBe(true);
      expect(isEmptySpacerRow([null, null, null])).toBe(true);
      expect(isEmptySpacerRow(['', '   ', undefined])).toBe(true);
    });

    it('identifies rows with non-empty values as not empty', () => {
      expect(isEmptySpacerRow([null, 'data', null])).toBe(false);
      expect(isEmptySpacerRow([0])).toBe(false);
      expect(isEmptySpacerRow([false])).toBe(false);
    });
  });

  describe('isSubtotalRow', () => {
    it('identifies total, subtotal, sum, and average aggregation rows', () => {
      expect(isSubtotalRow(['Total', 1000, 2000])).toBe(true);
      expect(isSubtotalRow(['Subtotal', 500, 700])).toBe(true);
      expect(isSubtotalRow(['Grand Total', 15000])).toBe(true);
      expect(isSubtotalRow(['SUM', 300])).toBe(true);
      expect(isSubtotalRow(['Average', 50])).toBe(true);
      expect(isSubtotalRow(['Avg deal size', 25])).toBe(true);
    });

    it('does not flag normal data rows as subtotals', () => {
      expect(isSubtotalRow(['Alice', 100, 'North'])).toBe(false);
      expect(isSubtotalRow(['Totally Awesome Inc.', 500])).toBe(false);
    });
  });

  describe('isFootnoteRow', () => {
    it('identifies asterisk notes and footnote indicators', () => {
      expect(isFootnoteRow(['* Data unaudited and subject to revision', null, null], 3)).toBe(
        true
      );
      expect(isFootnoteRow(['Note: All figures in thousands', null, null], 3)).toBe(true);
      expect(isFootnoteRow(['Source: Internal financial system', null, null], 3)).toBe(true);
      expect(isFootnoteRow(['Confidential - Do not distribute', null, null], 3)).toBe(true);
    });

    it('does not flag normal tabular data rows as footnotes', () => {
      expect(isFootnoteRow(['Electronics', 'Phones', 1000], 3)).toBe(false);
    });
  });

  describe('removeNoiseRows', () => {
    it('removes spacer rows, subtotal rows, and trailing footnotes while preserving clean data', () => {
      const dataRows = [
        ['Alice', 'Sales', 5000],
        ['Bob', 'Sales', 4000],
        ['Subtotal Sales', null, 9000],
        ['Charlie', 'Engineering', 6000],
        ['', '   ', null], // Empty spacer
        ['David', 'Engineering', 7000],
        ['Total', null, 22000], // Subtotal
        ['* Data as of Q4 2024', null, null], // Trailing footnote
        [null, null, null], // Trailing empty row
      ];

      const cleaned = removeNoiseRows(dataRows, 3);
      expect(cleaned).toEqual([
        ['Alice', 'Sales', 5000],
        ['Bob', 'Sales', 4000],
        ['Charlie', 'Engineering', 6000],
        ['David', 'Engineering', 7000],
      ]);
    });

    it('guarantees that row count never increases', () => {
      const rows = [
        ['A', 1],
        ['B', 2],
      ];
      const cleaned = removeNoiseRows(rows, 2);
      expect(cleaned.length).toBeLessThanOrEqual(rows.length);
    });
  });
});
