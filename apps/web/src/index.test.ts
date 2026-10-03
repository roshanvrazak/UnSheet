import { describe, it, expect } from 'vitest';
import { getAppStatus } from './index.js';

describe('getAppStatus', () => {
  it('returns valid app status incorporating packages', () => {
    const status = getAppStatus();
    expect(status.status).toBe('ready');
    expect(status.engine.name).toBe('@unsheet/engine');
    expect(status.fixture.name).toBe('@unsheet/fixtures/sample');
  });
});
