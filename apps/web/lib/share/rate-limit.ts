import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse, RateLimitConfig } from '../llm/rate-limit';

const SHARE_LOOKUP_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000, // 60 requests per minute per IP
};

export function checkShareLookupRateLimit(req: Request): NextResponse | null {
  const result = checkRateLimit(req, 'share-lookup', SHARE_LOOKUP_RATE_LIMIT_CONFIG);
  if (!result.success) {
    return rateLimitResponse(result.retryAfterSeconds);
  }
  return null;
}
