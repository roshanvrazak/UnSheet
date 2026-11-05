import { isIP } from 'node:net';

export class AIRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryAfterSeconds = 0) {
    super(message);
  }
}

/** Exact origins are administered on the server, never supplied by a caller. */
export function validateAIEndpoint(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new AIRequestError('Invalid AI endpoint URL', 400); }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.port && url.port !== '443') || isIP(host) || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new AIRequestError('AI endpoints must use an approved public HTTPS origin', 400);
  }
  const approved = new Set(['https://api.openai.com', 'https://api.x.ai']);
  for (const origin of (process.env.AI_ALLOWED_ORIGINS || '').split(',').map(item => item.trim()).filter(Boolean)) {
    // Config entries must be origins, without paths or wildcards.
    if (origin === new URL(origin).origin) approved.add(origin);
  }
  if (!approved.has(url.origin)) throw new AIRequestError('AI endpoint origin is not approved by the server', 400);
  return url.toString().replace(/\/$/, '');
}

export function endpointFetch(baseURL: string): typeof fetch {
  const origin = new URL(baseURL).origin;
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (new URL(url).origin !== origin) throw new AIRequestError('AI request destination changed', 400);
    // A provider redirect must never forward credentials or reach another destination.
    return fetch(input, { ...init, redirect: 'error' });
  };
}
