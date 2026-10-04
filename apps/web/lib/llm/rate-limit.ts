import { NextResponse } from 'next/server';

interface RateLimitStore {
  timestamps: number[];
}

const store = new Map<string, RateLimitStore>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 60_000);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, 60_000).unref?.();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs?: number;
}

export function checkRateLimit(
  req: Request,
  actionKey: string,
  config: RateLimitConfig
): { success: boolean; remaining: number; retryAfterSeconds: number } {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor ? (forwardedFor.split(',')[0] || '127.0.0.1').trim() : req.headers.get('x-real-ip') || '127.0.0.1';
  const key = `${actionKey}:${ip}`;

  const now = Date.now();
  const windowMs = config.windowMs || 60_000;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestTimestamp = entry.timestamps[0] || now;
    const retryAfterMs = windowMs - (now - oldestTimestamp);
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    return {
      success: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  entry.timestamps.push(now);
  const remaining = config.maxRequests - entry.timestamps.length;
  return {
    success: true,
    remaining,
    retryAfterSeconds: 0,
  };
}

export function rateLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}
