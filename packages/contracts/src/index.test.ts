import { describe, it, expect } from 'vitest';
import { VersionSchema } from './index.js';

describe('VersionSchema', () => {
  it('validates a valid version object', () => {
    const valid = { version: '0.1.0', name: 'unsheet' };
    const result = VersionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid objects', () => {
    const invalid = { version: '', name: '' };
    const result = VersionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
