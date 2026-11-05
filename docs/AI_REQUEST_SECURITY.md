# AI request protection

Applies to query generation, specification refinement, and connection testing. Production provider calls require a configured Supabase URL, the server-only service-role key, and migration `20261009000000_ai_request_limits.sql`. A missing or failing quota backend returns 503 before provider execution. Deterministic demo answers without a provider remain available. Development and tests use a process-local limiter when Supabase is absent.

## Request limits

The atomic database function admits at most 120 requests per minute globally, 30 per caller identity across all actions, and per-action limits of 30 queries, 20 refinements, or 5 connection tests per minute. Four provider calls may run concurrently across server instances. Quota denials return 429 with Retry-After. Admission uses a transaction advisory lock; short-lived concurrency leases expire after 30 seconds if a server disappears. Normal completion/failure releases the lease. Requests are not monetary budgets: query/refinement can retry once within their deadline.

Anonymous callers share an identity unless `AI_TRUSTED_IP_HEADER` is configured. Set it only to a header that your ingress overwrites and strips from client requests; do not trust freely supplied forwarding headers. Only a SHA-256 digest of that identity is stored. The global limit applies regardless of identity changes.

Connection tests have a 10-second deadline, no retries, and 10 output tokens. Queries/refinements have a 20-second deadline and output ceilings of 4,096/8,192 tokens. All provider calls include request-disconnect cancellation. Query/refinement bodies are streamed with a 256KiB ceiling even without Content-Length, and their contracts allow at most 200 column profiles.

## Provider destinations

OpenAI and xAI HTTPS origins are approved by default. Custom origins require exact entries in server `AI_ALLOWED_ORIGINS`, separated by commas. Both client and server endpoint overrides use this policy. IP literals, localhost, .local names, credentials, query strings, fragments, HTTP, and nonstandard ports are rejected. Only approve domains controlled by trusted operators; an allowlist is not a DNS sandbox. Deployment egress rules should also prevent these approved domains from resolving into private networks.

The provider fetch wrapper rejects destination-origin changes and disables redirects. Client routing overrides are accepted only with client-owned API keys, so they cannot redirect server credentials.

## Verification and rollout

Apply the migration before deploying production AI routes. Keep service-role credentials server-only. Tests cover quota admission/denial, concurrency release, failure-closed behavior, forged IP headers, endpoint rejection, redirect prevention, payload bounds, and profile bounds. The database quota function can be checked transactionally against a migrated local Supabase instance:

```sh
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/ai_request_limits.sql
```

The SQL test clears quota fixtures inside a rolled-back transaction. Run it only against a local test database; mocked API tests do not establish database concurrency behavior.
