/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  packageManager: 'pnpm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'vitest',
  mutate: [
    'packages/engine/src/**/*.ts',
    '!packages/engine/src/**/*.test.ts',
    '!packages/engine/src/**/*.d.ts'
  ],
  thresholds: {
    high: 80,
    low: 70,
    break: 80
  },
  vitest: {
    configFile: 'packages/engine/vitest.config.ts'
  }
};
