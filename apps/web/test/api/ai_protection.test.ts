import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { transferableAbortController } from 'node:util';

const mocks = vi.hoisted(() => ({ generateText: vi.fn(), rpc: vi.fn(), createClient: vi.fn() }));
vi.mock('ai', () => ({ generateText: mocks.generateText }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('SUPABASE_URL', ''); vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', ''); vi.stubEnv('AI_TRUSTED_IP_HEADER', '');
  vi.stubEnv('DISABLE_LLM', ''); vi.stubEnv('OPENAI_API_KEY', 'sk-server');
  vi.stubEnv('GROK_API_KEY', ''); vi.stubEnv('XAI_API_KEY', ''); vi.stubEnv('AI_ALLOWED_ORIGINS', '');
  mocks.generateText.mockReset().mockResolvedValue({ text: 'READY' });
  mocks.rpc.mockReset();
  mocks.createClient.mockReturnValue({ rpc: mocks.rpc });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const req = (headers: Record<string, string> = {}) => new NextRequest('http://localhost/api/llm/test', { method: 'POST', headers });

describe('AI connection protection', () => {
  it('limits anonymous tests despite forged IP headers and resets after the window', async () => {
    vi.useFakeTimers();
    const { POST } = await import('@/app/api/llm/test/route');
    for (let i = 0; i < 5; i++) expect((await POST(req({ 'x-forwarded-for': `10.0.0.${i}` }))).status).toBe(200);
    const denied = await POST(req({ 'x-real-ip': 'new-identity' }));
    expect(denied.status).toBe(429);
    expect(denied.headers.get('Retry-After')).toBe('60');
    expect(mocks.generateText).toHaveBeenCalledTimes(5);
    vi.advanceTimersByTime(60001);
    expect((await POST(req())).status).toBe(200);
  });

  it('sets cancellation and disables connection-test retries; hides provider error details', async () => {
    const { POST } = await import('@/app/api/llm/test/route');
    mocks.generateText.mockRejectedValueOnce(new Error('upstream echoed sk-secret'));
    const res = await POST(req());
    expect((await res.json()).error).not.toContain('sk-secret');
    expect(mocks.generateText.mock.calls[0]?.[0]).toMatchObject({ maxRetries: 0, maxTokens: 10 });
    expect(mocks.generateText.mock.calls[0]?.[0].abortSignal).toBeDefined();
    // A failed provider request releases the concurrency slot.
    expect((await POST(req())).status).toBe(200);
  });

  it('cancels provider work when the incoming request is aborted', async () => {
    const { POST } = await import('@/app/api/llm/test/route');
    mocks.generateText.mockImplementationOnce(({ abortSignal }) => new Promise((_, reject) => {
      if (abortSignal.aborted) reject(new Error('cancelled'));
      else abortSignal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
    }));
    const controller = transferableAbortController();
    const pending = POST(new NextRequest('http://localhost/api/llm/test', { method: 'POST', signal: controller.signal }));
    controller.abort();
    expect((await pending).status).toBe(400);
    expect(mocks.generateText.mock.calls[0]?.[0].abortSignal.aborted).toBe(true);
    expect((await POST(req())).status).toBe(200);
  });

  it('rejects a blocked client endpoint before making a provider call', async () => {
    const { POST, GET } = await import('@/app/api/llm/test/route');
    const request = req({ 'x-api-key': 'sk-client', 'x-api-base-url': 'https://127.0.0.1/v1' });
    expect((await POST(request)).status).toBe(400);
    expect((await GET(request)).status).toBe(400);
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('fails closed in production if shared quotas are unconfigured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { POST } = await import('@/app/api/llm/test/route');
    expect((await POST(req())).status).toBe(503);
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});

describe('Shared quota and concurrency', () => {
  it('enforces four in-flight calls across actions and releases them on failure', async () => {
    const { runAIRequest } = await import('@/lib/llm/request-policy');
    const finish: Array<() => void> = [];
    const calls = Array.from({ length: 4 }, () => runAIRequest(req(), 'query-ask', () => new Promise<void>(resolve => finish.push(resolve))));
    await expect(runAIRequest(req(), 'spec-refine', async () => 'blocked')).rejects.toMatchObject({ status: 429 });
    finish.forEach(resolve => resolve());
    await Promise.all(calls);
    await expect(runAIRequest(req(), 'query-ask', async () => { throw new Error('failure'); })).rejects.toThrow('failure');
    expect(await runAIRequest(req(), 'spec-refine', async () => 'allowed')).toBe('allowed');
  });

  it('uses atomic RPC denial without calling the provider or releasing a nonexistent lease', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://quota.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-key');
    mocks.rpc.mockResolvedValue({ data: { allowed: false, retry_after: 42 }, error: null });
    const { POST } = await import('@/app/api/llm/test/route');
    const res = await POST(req({ 'x-forwarded-for': 'forged' }));
    expect(res.status).toBe(429); expect(res.headers.get('Retry-After')).toBe('42');
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0]?.[1]).toMatchObject({ p_action: 'llm-test', p_limit: 5 });
  });

  it('releases an admitted lease even when provider execution rejects', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://quota.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-key');
    mocks.rpc.mockResolvedValueOnce({ data: { allowed: true, lease_id: '11111111-1111-4111-8111-111111111111' }, error: null }).mockResolvedValueOnce({ error: null });
    const { runAIRequest } = await import('@/lib/llm/request-policy');
    await expect(runAIRequest(req(), 'query-ask', async () => { throw new Error('provider failed'); })).rejects.toThrow('provider failed');
    expect(mocks.rpc).toHaveBeenLastCalledWith('release_ai_request', { p_lease: '11111111-1111-4111-8111-111111111111' });
  });

  it('fails closed when the shared quota database is unavailable', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://quota.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-key');
    mocks.rpc.mockRejectedValue(new Error('database offline'));
    const { POST } = await import('@/app/api/llm/test/route');
    expect((await POST(req())).status).toBe(503);
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});

describe('Request payload boundary', () => {
  it('rejects more than 200 profiles and oversized route bodies before provider execution', async () => {
    const { AskYourDataRequestSchema } = await import('@unsheet/contracts');
    const profile = {
      columnKey: 'revenue', originalName: 'Revenue', inferredType: 'number', semanticRole: 'measure',
      nullable: false, nullCount: 0, totalCount: 1, distinctCount: 1, uniquenessRatio: 1, sampleValues: ['1'],
    };
    expect(AskYourDataRequestSchema.safeParse({ question: 'Revenue?', sheetName: 'sales', profiles: Array(200).fill(profile) }).success).toBe(true);
    expect(AskYourDataRequestSchema.safeParse({ question: 'Revenue?', sheetName: 'sales', profiles: Array(201).fill(profile) }).success).toBe(false);
    const { POST } = await import('@/app/api/query/ask/route');
    const res = await POST(new NextRequest('http://localhost/api/query/ask', { method: 'POST', body: 'x'.repeat(262145) }));
    expect(res.status).toBe(413);
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('rejects an oversized stream without trusting Content-Length', async () => {
    const { readAIRequestBody } = await import('@/lib/llm/request-policy');
    await expect(readAIRequestBody(new Request('https://example.com', { method: 'POST', body: 'x'.repeat(262145) }))).rejects.toMatchObject({ status: 413 });
    await expect(readAIRequestBody(new Request('https://example.com', { method: 'POST', body: '{' }))).rejects.toMatchObject({ status: 400 });
    expect(await readAIRequestBody(new Request('https://example.com', { method: 'POST', body: '{"question":"valid"}' }))).toEqual({ question: 'valid' });
  });
});
