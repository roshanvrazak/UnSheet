import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveLLM, getLLMStatus } from '@/lib/llm/provider';
import { NextRequest } from 'next/server';
import { GET as getLLMTest, POST as postLLMTest } from '@/app/api/llm/test/route';

describe('Unified LLM Provider & Auto-Detection Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GROK_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROK_BASE_URL;
    delete process.env.XAI_BASE_URL;
    delete process.env.OPENAI_BASE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when no keys are configured in env or headers', () => {
    const resolved = resolveLLM();
    expect(resolved).toBeNull();

    const status = getLLMStatus();
    expect(status.configured).toBe(false);
  });

  it('resolves xAI / Grok when GROK_API_KEY is present in env', () => {
    process.env.GROK_API_KEY = 'xai-grok-sample-key-123';
    const resolved = resolveLLM();
    expect(resolved).not.toBeNull();
    expect(resolved?.provider).toBe('grok');
    expect(resolved?.providerName).toBe('xAI (Grok)');
    expect(resolved?.modelName).toBe('grok-2-mini');
    expect(resolved?.source).toBe('env');
  });

  it('resolves xAI / Grok when XAI_API_KEY is present in env', () => {
    process.env.XAI_API_KEY = 'xai-sample-key-456';
    const resolved = resolveLLM();
    expect(resolved).not.toBeNull();
    expect(resolved?.provider).toBe('grok');
    expect(resolved?.modelName).toBe('grok-2-mini');
  });

  it('auto-detects xAI / Grok when OPENAI_API_KEY starts with xai- prefix', () => {
    // When users put their xAI key in OPENAI_API_KEY
    process.env.OPENAI_API_KEY = 'xai-my-grok-api-key';
    const resolved = resolveLLM();
    expect(resolved).not.toBeNull();
    expect(resolved?.provider).toBe('grok');
    expect(resolved?.providerName).toBe('xAI (Grok)');
    expect(resolved?.modelName).toBe('grok-2-mini');
  });

  it('resolves standard OpenAI when standard sk- key is in OPENAI_API_KEY', () => {
    process.env.OPENAI_API_KEY = 'sk-proj-openai-sample-key';
    const resolved = resolveLLM();
    expect(resolved).not.toBeNull();
    expect(resolved?.provider).toBe('openai');
    expect(resolved?.providerName).toBe('OpenAI');
    expect(resolved?.modelName).toBe('gpt-4o-mini');
  });

  it('respects client request headers for Grok key and model override', () => {
    const req = new NextRequest('http://localhost:3000/api/query/ask', {
      headers: {
        'x-api-key': 'xai-client-passed-key',
        'x-api-provider': 'grok',
        'x-api-model': 'grok-2',
      },
    });

    const resolved = resolveLLM(req);
    expect(resolved).not.toBeNull();
    expect(resolved?.provider).toBe('grok');
    expect(resolved?.modelName).toBe('grok-2');
    expect(resolved?.source).toBe('header');
  });

  it('GET /api/llm/test returns status', async () => {
    process.env.GROK_API_KEY = 'xai-test-key';
    const req = new NextRequest('http://localhost:3000/api/llm/test');
    const res = await getLLMTest(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.configured).toBe(true);
    expect(data.provider).toBe('grok');
  });

  it('POST /api/llm/test returns 400 when no key provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/llm/test', {
      method: 'POST',
    });
    const res = await postLLMTest(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('No API key provided');
  });
});
