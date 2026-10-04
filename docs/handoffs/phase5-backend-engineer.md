# Phase 5 Handoff Note: LLM Routes & Server-Side Integration

## Overview
Successfully implemented Phase 5 LLM Routes and robust server-side integrations in `@unsheet/web`, fulfilling all security, rate-limiting, prompt-engineering, and schema-validation requirements.

---

## Implemented Components

1. **Rate Limiting (`apps/web/lib/llm/rate-limit.ts`)**:
   - In-memory sliding window rate limiter per client IP.
   - Configurable max requests (20 calls/min for spec refinement, 30 calls/min for ask-your-data).
   - Returns standard HTTP `429 Too Many Requests` status with `Retry-After` header when limit is exceeded.

2. **Prompt Engineering & Injection Defense (`apps/web/lib/llm/prompts.ts`)**:
   - Strict data boundary delimiters (`<schema_metadata>`) enclosing sanitized column keys, inferred types, semantic roles, and capped sample values (<=5 items, <=40 chars).
   - System instructions enforcing strict untrusted data treatment, prevention of instruction following within schema metadata, and mandatory JSON structured responses adhering to target schemas.
   - Specific SQL generation constraints prohibiting DDL, DML, ATTACH, COPY, and file functions.

3. **Deterministic Fallbacks (`apps/web/lib/llm/fallback.ts`)**:
   - Rule-based modifier for spec refinement supporting title updates, KPI widget addition, and theme switching.
   - Rule-based query parser mapping natural language intent (top N, average, total) to safe SQL queries and corresponding dashboard widgets.

4. **Server API Routes**:
   - `POST /api/spec/refine`: Validates request via `SpecRefinementRequestSchema`, enforces rate limits, attempts Vercel AI SDK `generateObject` with OpenAI, falls back to rule-based modifier, and validates response against `SpecRefinementResponseSchema`.
   - `POST /api/query/ask`: Validates request via `AskYourDataRequestSchema`, enforces rate limits, generates SQL via AI SDK or fallback, validates SQL against `SafeSqlQuerySchema`, performs table and column allowlist validation against column profiles, and validates response against `AskYourDataResponseSchema`.

5. **Comprehensive Test Suite (`apps/web/test/api/`)**:
   - `apps/web/test/api/refine.test.ts`: Tests schema validation, prompt injection neutralisation, rate limiting, and response structure.
   - `apps/web/test/api/ask.test.ts`: Tests valid SQL generation, rejection of injected DDL/DML, allowlisted column validation, and rate limiting.

---

## Verification Results
- `pnpm --filter @unsheet/web test`: All tests pass successfully (including API test suites and renderer suites).
- `pnpm --filter @unsheet/web typecheck`: Clean typecheck with zero errors.
