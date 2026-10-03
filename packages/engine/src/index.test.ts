import { describe, it, expect } from 'vitest';
import { getEngineInfo } from './index.js';

describe('getEngineInfo', () => {
  it('returns valid engine information', () => {
    const info = getEngineInfo();
    expect(info.name).toBe('@unsheet/engine');
    expect(info.version).toBe('0.1.0');
  });
});
