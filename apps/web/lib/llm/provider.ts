import { createOpenAI } from '@ai-sdk/openai';
import { NextRequest } from 'next/server';
import { LanguageModel } from 'ai';

export interface ResolvedLLM {
  model: LanguageModel;
  provider: 'grok' | 'openai' | 'custom';
  providerName: string;
  modelName: string;
  source: 'header' | 'env';
}

/**
 * Resolves the appropriate LanguageModel instance based on incoming request headers
 * (from the client-side settings modal) or environment variables (GROK_API_KEY, XAI_API_KEY, OPENAI_API_KEY).
 *
 * Supports:
 * - xAI / Grok (keys starting with 'xai-', or GROK_API_KEY / XAI_API_KEY)
 * - OpenAI (standard 'sk-' keys or OPENAI_API_KEY)
 * - Custom OpenAI-compatible endpoints (OPENAI_BASE_URL, GROK_BASE_URL)
 */
export function resolveLLM(req?: NextRequest): ResolvedLLM | null {
  // 1. Client header overrides (if user set their key in the in-app UI)
  const headerKey =
    req?.headers.get('x-api-key') ||
    req?.headers.get('x-grok-api-key') ||
    req?.headers.get('x-openai-api-key') ||
    undefined;
  const headerProvider = req?.headers.get('x-api-provider') || undefined;
  const headerModel = req?.headers.get('x-api-model') || undefined;
  const headerBaseUrl = req?.headers.get('x-api-base-url') || undefined;

  // 2. Server environment variables
  const envGrokKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY || undefined;
  const envOpenAIKey = process.env.OPENAI_API_KEY || undefined;
  const envBaseUrl = process.env.GROK_BASE_URL || process.env.XAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined;
  const envModel = process.env.AI_MODEL || process.env.GROK_MODEL || process.env.OPENAI_MODEL || undefined;

  const apiKey = (headerKey && headerKey.trim() !== '') ? headerKey.trim() : (envGrokKey?.trim() || envOpenAIKey?.trim());
  const source: 'header' | 'env' = (headerKey && headerKey.trim() !== '') ? 'header' : 'env';

  if (!apiKey) {
    return null;
  }

  // 3. Detect if provider is Grok / xAI
  const isGrok =
    headerProvider === 'grok' ||
    headerProvider === 'xai' ||
    apiKey.startsWith('xai-') ||
    Boolean(envGrokKey && (!headerKey || headerProvider === 'grok' || headerProvider === 'xai'));

  if (isGrok) {
    const modelName = headerModel || envModel || 'grok-2-mini';
    const baseURL = headerBaseUrl || process.env.GROK_BASE_URL || process.env.XAI_BASE_URL || 'https://api.x.ai/v1';

    const provider = createOpenAI({ apiKey, baseURL });
    return {
      model: provider(modelName),
      provider: 'grok',
      providerName: 'xAI (Grok)',
      modelName,
      source,
    };
  }

  // 4. Custom OpenAI-compatible endpoint
  const baseURL = headerBaseUrl || envBaseUrl;
  if (baseURL) {
    const modelName = headerModel || envModel || 'gpt-4o-mini';
    const provider = createOpenAI({ apiKey, baseURL });
    return {
      model: provider(modelName),
      provider: 'custom',
      providerName: 'Custom LLM',
      modelName,
      source,
    };
  }

  // 5. Standard OpenAI
  const modelName = headerModel || envModel || 'gpt-4o-mini';
  const provider = createOpenAI({ apiKey });
  return {
    model: provider(modelName),
    provider: 'openai',
    providerName: 'OpenAI',
    modelName,
    source,
  };
}

export function getLLMStatus(req?: NextRequest): {
  configured: boolean;
  provider: 'grok' | 'openai' | 'custom' | null;
  providerName: string | null;
  modelName: string | null;
  source: 'header' | 'env' | null;
} {
  const resolved = resolveLLM(req);
  if (!resolved) {
    return {
      configured: false,
      provider: null,
      providerName: null,
      modelName: null,
      source: null,
    };
  }
  return {
    configured: true,
    provider: resolved.provider,
    providerName: resolved.providerName,
    modelName: resolved.modelName,
    source: resolved.source,
  };
}
