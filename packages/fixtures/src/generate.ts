import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GeneratedFixture } from './types.js';
import { fixtureGenerators, fixtureMetadata } from './generators/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface GenerateOptions {
  outputDir?: string;
  goldenDir?: string;
  silent?: boolean;
}

/**
 * Generates all 28 synthetic and messy workbooks along with golden normalized JSON baselines.
 */
export async function generateAllFixtures(options: GenerateOptions = {}): Promise<GeneratedFixture[]> {
  const rootDir = path.resolve(__dirname, '..');
  const outputDir = options.outputDir ?? path.join(rootDir, 'files');
  const goldenDir = options.goldenDir ?? path.join(rootDir, 'src', 'golden');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  if (!fs.existsSync(goldenDir)) {
    fs.mkdirSync(goldenDir, { recursive: true });
  }

  const generatedFixtures: GeneratedFixture[] = [];

  for (const meta of fixtureMetadata) {
    const generatorFn = fixtureGenerators[meta.id];
    if (!generatorFn) {
      throw new Error(`Generator function not found for fixture ID: ${meta.id}`);
    }

    const fixture = await generatorFn();
    generatedFixtures.push(fixture);

    // Write workbook file (xlsx / csv)
    const filePath = path.join(outputDir, fixture.filename);
    fs.writeFileSync(filePath, fixture.buffer);

    // Write golden normalized baseline JSON
    const goldenPath = path.join(goldenDir, `${fixture.id}.golden.json`);
    fs.writeFileSync(goldenPath, JSON.stringify(fixture.golden, null, 2), 'utf-8');

    if (!options.silent) {
      console.log(`[Generated] #${meta.number.toString().padStart(2, '0')} ${meta.filename} (${fixture.buffer.byteLength} bytes) -> Golden: ${fixture.id}.golden.json`);
    }
  }

  return generatedFixtures;
}

// Auto-run if executed directly as main script
const isMainScript = process.argv[1] && (
  process.argv[1] === __filename ||
  process.argv[1].endsWith('generate.ts') ||
  process.argv[1].endsWith('generate.js')
);

if (isMainScript) {
  console.log('--- UnSheet Fixture Generator: Building 28 Workbooks & Golden Baselines ---');
  const t0 = performance.now();
  generateAllFixtures()
    .then((results) => {
      const elapsed = Math.round(performance.now() - t0);
      console.log(`Successfully generated all ${results.length} fixtures in ${elapsed}ms.`);
    })
    .catch((err) => {
      console.error('Fatal error generating fixtures:', err);
      process.exit(1);
    });
}
