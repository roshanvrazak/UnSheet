import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Version } from '@unsheet/contracts';
import type { GoldenWorkbook, FixtureMeta } from './types.js';
import { fixtureGenerators, fixtureMetadata } from './generators/index.js';
import { generateAllFixtures, type GenerateOptions } from './generate.js';

export * from './types.js';
export * from './generators/index.js';
export { generateAllFixtures, type GenerateOptions };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SampleFixture: Version = {
  version: '0.1.0',
  name: '@unsheet/fixtures/sample',
};

/**
 * Resolves a fixture metadata entry by ID or sequential number (1..28).
 */
export function getFixtureMeta(idOrNumber: string | number): FixtureMeta | undefined {
  if (typeof idOrNumber === 'number') {
    return fixtureMetadata.find((m) => m.number === idOrNumber);
  }
  return fixtureMetadata.find((m) => m.id === idOrNumber || m.filename === idOrNumber);
}

/**
 * Returns the absolute filesystem path to a pre-generated fixture workbook.
 */
export function getFixtureFilePath(idOrNumber: string | number): string {
  const meta = getFixtureMeta(idOrNumber);
  if (!meta) {
    throw new Error(`Fixture not found for ID or number: ${idOrNumber}`);
  }
  return path.resolve(__dirname, '..', 'files', meta.filename);
}

/**
 * Loads the binary buffer for a fixture, either from pre-generated file on disk
 * or via in-memory generator if not present on disk.
 */
export async function getFixtureBuffer(idOrNumber: string | number): Promise<Buffer> {
  const meta = getFixtureMeta(idOrNumber);
  if (!meta) {
    throw new Error(`Fixture not found for ID or number: ${idOrNumber}`);
  }

  const filePath = getFixtureFilePath(idOrNumber);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }

  // Fallback to on-demand generation
  const generatorFn = fixtureGenerators[meta.id];
  if (!generatorFn) {
    throw new Error(`Generator not found for fixture: ${meta.id}`);
  }
  const result = await generatorFn();
  return result.buffer;
}

/**
 * Returns the golden normalized JSON baseline for a given fixture.
 */
export function getFixtureGolden(idOrNumber: string | number): GoldenWorkbook {
  const meta = getFixtureMeta(idOrNumber);
  if (!meta) {
    throw new Error(`Fixture not found for ID or number: ${idOrNumber}`);
  }

  const goldenPath = path.resolve(__dirname, 'golden', `${meta.id}.golden.json`);
  if (!fs.existsSync(goldenPath)) {
    throw new Error(`Golden baseline file does not exist at: ${goldenPath}`);
  }

  const content = fs.readFileSync(goldenPath, 'utf-8');
  return JSON.parse(content) as GoldenWorkbook;
}

/**
 * Loads all 28 golden normalized baselines indexed by fixture ID.
 */
export function getAllGoldenBaselines(): Record<string, GoldenWorkbook> {
  const result: Record<string, GoldenWorkbook> = {};
  for (const meta of fixtureMetadata) {
    result[meta.id] = getFixtureGolden(meta.id);
  }
  return result;
}

/**
 * Lists all fixture metadata records.
 */
export function getAllFixtureMetas(): FixtureMeta[] {
  return [...fixtureMetadata];
}
