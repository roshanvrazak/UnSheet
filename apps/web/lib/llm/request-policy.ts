import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { AIRequestError } from './endpoint';

const buckets = new Map<string, { start: number; count: number }>();
let active = 0;
const limits = { 'query-ask': 30, 'spec-refine': 20, 'llm-test': 5 } as const;
type Action = keyof typeof limits;

function identity(req: Request): string {
  // Trust an ingress header only when explicitly configured and overwritten by that ingress.
  const header = process.env.AI_TRUSTED_IP_HEADER;
  const client = header ? req.headers.get(header)?.trim() || 'unknown' : 'unknown';
  return createHash('sha256').update(client).digest('hex');
}

export async function runAIRequest<T>(req: Request, action: Action, run: () => Promise<T>): Promise<T> {
  const actor = identity(req);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let release: () => Promise<void>;
  if (url && key) {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) },
    });
    let result;
    try {
      result = await client.rpc('acquire_ai_request', { p_actor: actor, p_action: action, p_limit: limits[action] });
    } catch { throw new AIRequestError('AI request protection is unavailable', 503); }
    if (result.error || !result.data || typeof result.data.allowed !== 'boolean') throw new AIRequestError('AI request protection is unavailable', 503);
    if (!result.data.allowed) throw new AIRequestError('AI request limit reached. Please retry later.', 429, result.data.retry_after || 1);
    const lease = result.data.lease_id;
    if (typeof lease !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(lease)) throw new AIRequestError('AI request protection is unavailable', 503);
    release = async () => {
      // A failed release leaves the bounded lease until expiry, never opens extra capacity.
      try {
        const result = await client.rpc('release_ai_request', { p_lease: lease });
        if (result.error) console.warn('AI request lease release failed');
      } catch { console.warn('AI request lease release failed'); }
    };
  } else {
    if (process.env.NODE_ENV === 'production') throw new AIRequestError('Distributed AI request protection must be configured', 503);
    const now = Date.now();
    for (const [key, bucket] of buckets) if (now - bucket.start >= 60000) buckets.delete(key);
    const keys = [['global', 120], [actor, 30], [`${actor}:${action}`, limits[action]]] as const;
    for (const [key, limit] of keys) {
      const bucket = buckets.get(key);
      if (bucket && bucket.count >= limit) throw new AIRequestError('AI request limit reached. Please retry later.', 429, Math.ceil((bucket.start + 60000 - now) / 1000));
    }
    if (active >= 4) throw new AIRequestError('AI requests are busy. Please retry later.', 429, 1);
    for (const [key] of keys) {
      const bucket = buckets.get(key) || { start: now, count: 0 };
      bucket.count++; buckets.set(key, bucket);
    }
    active++;
    release = async () => { active--; };
  }
  try { return await run(); } finally { await release(); }
}


/** Enforce the byte limit while streaming, even without a Content-Length header. */
export async function readAIRequestBody(req: Request): Promise<unknown> {
  const maxBytes = 256 * 1024;
  const length = Number(req.headers.get('content-length'));
  if (length > maxBytes) throw new AIRequestError('AI request exceeds 256KB', 413);
  const reader = req.body?.getReader();
  if (!reader) throw new AIRequestError('Invalid JSON request', 400);
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new AIRequestError('AI request exceeds 256KB', 413); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AIRequestError('Invalid JSON request', 400); }
}
