import { describe, it, expect } from 'vitest';
import { SampleFixture } from './index.js';

describe('SampleFixture', () => {
  it('contains expected fixture properties', () => {
    expect(SampleFixture.name).toBe('@unsheet/fixtures/sample');
    expect(SampleFixture.version).toBe('0.1.0');
  });
});
