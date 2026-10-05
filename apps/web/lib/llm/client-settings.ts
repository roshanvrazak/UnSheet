'use client';

export interface ClientAISettings {
  provider: 'grok' | 'openai' | 'custom';
  apiKey: string;
  model: string;
  baseUrl?: string | undefined;
}

const STORAGE_KEY = 'unsheet_ai_settings';

export function getClientAISettings(): ClientAISettings {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined' || !window.localStorage) {
    return {
      provider: 'grok',
      apiKey: '',
      model: 'grok-2-mini',
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        provider: parsed.provider || (parsed.apiKey?.startsWith('xai-') ? 'grok' : 'openai'),
        apiKey: parsed.apiKey || '',
        model: parsed.model || (parsed.provider === 'grok' || parsed.apiKey?.startsWith('xai-') ? 'grok-2-mini' : 'gpt-4o-mini'),
        baseUrl: parsed.baseUrl || undefined,
      };
    }
  } catch {
    // Ignore error in test/sandboxed environments
  }

  return {
    provider: 'grok',
    apiKey: '',
    model: 'grok-2-mini',
  };
}

export function saveClientAISettings(settings: ClientAISettings): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore error in test/sandboxed environments
  }
}

export function getAIHeaders(): Record<string, string> {
  const settings = getClientAISettings();
  const headers: Record<string, string> = {};

  if (settings.apiKey && settings.apiKey.trim() !== '') {
    headers['x-api-key'] = settings.apiKey.trim();
    headers['x-api-provider'] = settings.provider;
    if (settings.model) {
      headers['x-api-model'] = settings.model.trim();
    }
    if (settings.baseUrl) {
      headers['x-api-base-url'] = settings.baseUrl.trim();
    }
  }

  return headers;
}
