# Phase 6 Backend Hand-off: Share Links, Supabase Migrations, and RLS

## Summary of Implementation

We have successfully implemented Phase 6 backend architecture for secure dashboard sharing, template persistence, Row Level Security (RLS), threat-resistant token lookup enumeration protection, and sliding-window rate limiting in `apps/web` and `supabase/migrations`.

---

## Artifacts & Code Created

1. **Supabase Migration**:
   - [`20261004000000_phase6_shares_and_templates.sql`](file:///home/rvr/Work/basi/UnSheet/supabase/migrations/20261004000000_phase6_shares_and_templates.sql):
     - Created `templates` table (`id`, `user_id`, `name`, `description`, `category`, `spec`, `fingerprint`, timestamps).
     - Created `share_links` table (`id`, `user_id`, `share_token`, `title`, `spec`, `allow_export`, `data_snapshot`, `expires_at`, `is_revoked`, `created_at`).
     - Enabled RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
     - Configured strict deny-by-default RLS policies:
       - `templates`: `auth.uid() = user_id` for SELECT, INSERT, UPDATE, DELETE.
       - `share_links`: Public read for active/unexpired links `(is_revoked = false) AND (expires_at IS NULL OR expires_at > now())`, owner/system insert/update/delete.
     - Created performance and lookup indexes (`idx_share_links_token`, `idx_templates_user_id`).

2. **Token Generation**:
   - [`token.ts`](file:///home/rvr/Work/basi/UnSheet/apps/web/lib/share/token.ts): Uses `node:crypto.randomBytes(16).toString('base64url')` (22 chars, 128 bits entropy, URL-safe) validated against `@unsheet/contracts` `ShareTokenSchema`.

3. **Storage & Fallback Layer**:
   - [`store.ts`](file:///home/rvr/Work/basi/UnSheet/apps/web/lib/share/store.ts): Supports Supabase client persistence with automatic in-memory fallback for offline/demo mode and local testing.

4. **Rate Limiting**:
   - [`rate-limit.ts`](file:///home/rvr/Work/basi/UnSheet/apps/web/lib/share/rate-limit.ts): Sliding window rate limiter enforcing 60 lookups/min per IP on share lookups to prevent brute-force token enumeration.

5. **API Endpoints**:
   - [`POST /api/share`](file:///home/rvr/Work/basi/UnSheet/apps/web/app/api/share/route.ts): Validates requests via Zod contracts, generates share token and expiration, and stores link.
   - [`GET /api/share/[token]`](file:///home/rvr/Work/basi/UnSheet/apps/web/app/api/share/[token]/route.ts): Applies rate limiting, looks up token, and enforces the crucial security threat model: **missing, expired, revoked, or malformed tokens return identical 404 responses (`{ error: 'Share link not found or expired' }`)** to prevent timing or error-based enumeration oracles.
   - [`POST /api/share/[token]/revoke`](file:///home/rvr/Work/basi/UnSheet/apps/web/app/api/share/[token]/revoke/route.ts): Revokes active share links.

6. **Test Suite**:
   - [`share.test.ts`](file:///home/rvr/Work/basi/UnSheet/apps/web/test/api/share.test.ts): Comprehensive Vitest test suite covering token entropy, link creation, active retrieval, identical 404 responses for missing/revoked tokens, rate-limiting (429), and SQL migration/RLS policy verification.

---

## Verification Results

- **Vitest Unit & Integration Tests**: All 6 test suites passed successfully (`pnpm --filter @unsheet/web test share.test.ts`).
- **TypeScript Typechecking**: Zero errors (`pnpm --filter @unsheet/web typecheck`).
- **ESLint**: Zero lint errors or warnings (`pnpm lint --quiet`).
