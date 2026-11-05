-- Local migrated Supabase database only. Fixture changes roll back.
BEGIN;
DELETE FROM public.ai_request_leases;
DELETE FROM public.ai_request_buckets;
SET LOCAL ROLE service_role;
DO $$
DECLARE answer jsonb; leases uuid[] := ARRAY[]::uuid[]; lease uuid; i integer;
BEGIN
  FOR i IN 1..4 LOOP
    answer := public.acquire_ai_request(repeat('a',64), 'query-ask', 30);
    IF (answer->>'allowed')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Expected admission'; END IF;
    leases := array_append(leases, (answer->>'lease_id')::uuid);
  END LOOP;
  answer := public.acquire_ai_request(repeat('b',64), 'spec-refine',20);
  IF (answer->>'allowed')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'Global concurrency exceeded'; END IF;
  FOREACH lease IN ARRAY leases LOOP PERFORM public.release_ai_request(lease); END LOOP;
  FOR i IN 1..5 LOOP
    answer := public.acquire_ai_request(repeat('b',64), 'llm-test',5);
    IF (answer->>'allowed')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Expected test admission'; END IF;
    PERFORM public.release_ai_request((answer->>'lease_id')::uuid);
  END LOOP;
  answer := public.acquire_ai_request(repeat('b',64), 'llm-test',5);
  IF (answer->>'allowed')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'Connection test quota exceeded'; END IF;
  FOR i IN 1..26 LOOP
    answer := public.acquire_ai_request(repeat('a',64), 'query-ask',30);
    IF (answer->>'allowed')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Expected query admission'; END IF;
    PERFORM public.release_ai_request((answer->>'lease_id')::uuid);
  END LOOP;
  answer := public.acquire_ai_request(repeat('a',64), 'spec-refine',20);
  IF (answer->>'allowed')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'Cross-action actor quota exceeded'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.acquire_ai_request(repeat('c',64), 'llm-test',5);
    RAISE EXCEPTION 'Anonymous quota RPC access allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
