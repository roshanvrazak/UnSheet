import { afterEach, describe, expect, it, vi } from 'vitest';
import { endpointFetch, validateAIEndpoint } from '@/lib/llm/endpoint';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('AI endpoint boundaries', () => {
  it.each([
    'http://api.openai.com/v1', 'https://127.0.0.1/v1', 'https://[::1]/v1',
    'https://169.254.169.254/v1', 'https://localhost/v1', 'https://api.openai.com.attacker.example/v1',
    'https://user:password@api.openai.com/v1', 'https://api.openai.com:444/v1',
    'https://api.openai.com/v1?url=private', 'https://api.openai.com/v1#fragment',
    'file:///etc/passwd', 'https://2130706433/v1',
  ])('rejects %s', value => expect(() => validateAIEndpoint(value)).toThrow());

  it('allows standard providers and only explicitly configured custom origins', () => {
    expect(validateAIEndpoint('https://api.openai.com/v1')).toBe('https://api.openai.com/v1');
    expect(() => validateAIEndpoint('https://proxy.example.com/v1')).toThrow();
    vi.stubEnv('AI_ALLOWED_ORIGINS', 'https://proxy.example.com');
    expect(validateAIEndpoint('https://proxy.example.com/v1')).toBe('https://proxy.example.com/v1');
    expect(() => validateAIEndpoint('https://sub.proxy.example.com/v1')).toThrow();
  });

  it('blocks redirects and rejects origin changes before fetch', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const guarded = endpointFetch('https://api.openai.com/v1');
    await guarded('https://api.openai.com/v1/chat/completions', { redirect: 'follow' });
    expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({ redirect: 'error' }));
    await expect(guarded('https://private.example.com/v1')).rejects.toThrow('destination changed');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
