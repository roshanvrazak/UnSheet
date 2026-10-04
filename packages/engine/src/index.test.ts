import { describe, it, expect } from 'vitest';
import { getEngineInfo, toLLMColumnProfile, toLLMSheetProfile } from './index.js';

describe('Engine index exports', () => {
  it('returns valid engine information', () => {
    const info = getEngineInfo();
    expect(info.name).toBe('@unsheet/engine');
    expect(info.version).toBe('0.1.0');
  });

  it('exports toLLMColumnProfile and toLLMSheetProfile functions', () => {
    expect(typeof toLLMColumnProfile).toBe('function');
    expect(typeof toLLMSheetProfile).toBe('function');
  });
});
