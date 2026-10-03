import type { Version } from '@unsheet/contracts';

export function getEngineInfo(): Version {
  return {
    version: '0.1.0',
    name: '@unsheet/engine'
  };
}
