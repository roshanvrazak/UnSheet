import { getEngineInfo } from '@unsheet/engine';
import { SampleFixture } from '@unsheet/fixtures';

export function getAppStatus() {
  return {
    engine: getEngineInfo(),
    fixture: SampleFixture,
    status: 'ready'
  };
}
