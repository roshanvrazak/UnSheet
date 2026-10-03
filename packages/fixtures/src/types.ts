import type { InferredDataType, SafeIdentifier } from '@unsheet/contracts';

export interface GoldenHeaderInfo {
  detectedRowIndex: number;
  confidence: number;
  originalHeaders: string[];
  sanitizedKeys: SafeIdentifier[];
}

export interface GoldenSheet {
  sheetName: string;
  headers: GoldenHeaderInfo;
  inferredTypes: Record<SafeIdentifier, InferredDataType>;
  rowCount: number;
  columnCount: number;
  rows: Array<Record<SafeIdentifier, unknown>>;
  metadata?: {
    primaryKey?: SafeIdentifier;
    foreignKeys?: Array<{
      column: SafeIdentifier;
      targetSheet: string;
      targetColumn: SafeIdentifier;
    }>;
    notes?: string[];
    hiddenColumns?: string[];
    hiddenSheet?: boolean;
    hasMergedCells?: boolean;
    hasFormulas?: boolean;
    formulaEvaluationPresent?: boolean;
    delimiter?: string;
    dateSystem?: '1900' | '1904';
  };
}

export interface GoldenWorkbook {
  fixtureId: string;
  fixtureNumber: number;
  filename: string;
  format: 'xlsx' | 'csv' | 'tsv';
  description: string;
  sheets: GoldenSheet[];
}

export interface GeneratedFixture {
  id: string;
  number: number;
  filename: string;
  format: 'xlsx' | 'csv' | 'tsv';
  description: string;
  buffer: Buffer;
  golden: GoldenWorkbook;
}

export type FixtureGeneratorFn = () => Promise<GeneratedFixture> | GeneratedFixture;

export interface FixtureMeta {
  id: string;
  number: number;
  filename: string;
  format: 'xlsx' | 'csv' | 'tsv';
  description: string;
  category:
    | 'baseline'
    | 'structure'
    | 'types'
    | 'dates'
    | 'numbers'
    | 'metadata'
    | 'extreme'
    | 'international'
    | 'formulas'
    | 'delimiters'
    | 'hostile'
    | 'domain';
}
