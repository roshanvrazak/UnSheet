-- Atomic quotas and short-lived concurrency leases shared by all server instances.
CREATE TABLE public.ai_request_buckets (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  requests integer NOT NULL DEFAULT 0
);
CREATE TABLE public.ai_request_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.ai_request_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_request_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_request_buckets, public.ai_request_leases FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.acquire_ai_request(p_actor text, p_action text, p_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  stamp timestamptz := clock_timestamp();
  bucket_key text;
  cap integer;
  bucket public.ai_request_buckets%ROWTYPE;
  lease uuid;
  expected_limit integer;
BEGIN
  expected_limit := CASE p_action WHEN 'llm-test' THEN 5 WHEN 'query-ask' THEN 30 WHEN 'spec-refine' THEN 20 ELSE NULL END;
  IF p_actor IS NULL OR p_actor !~ '^[a-f0-9]{64}$' OR expected_limit IS NULL OR p_limit IS DISTINCT FROM expected_limit THEN
    RAISE EXCEPTION 'Invalid AI quota arguments';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(90411930);
  -- Sample time after acquiring the lock, so a waiter never uses stale lease/window time.
  stamp := clock_timestamp();
  DELETE FROM public.ai_request_buckets WHERE window_start <= stamp - interval '1 minute';
  DELETE FROM public.ai_request_leases WHERE expires_at <= stamp;
  FOREACH bucket_key IN ARRAY ARRAY['global', p_actor, p_actor || ':' || p_action] LOOP
    cap := CASE WHEN bucket_key = 'global' THEN 120 WHEN bucket_key = p_actor THEN 30 ELSE expected_limit END;
    SELECT * INTO bucket FROM public.ai_request_buckets WHERE key = bucket_key;
    IF FOUND AND bucket.requests >= cap THEN
      RETURN jsonb_build_object('allowed', false, 'retry_after', greatest(1, ceil(extract(epoch FROM bucket.window_start + interval '1 minute' - stamp))));
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.ai_request_leases) >= 4 THEN
    RETURN jsonb_build_object('allowed', false, 'retry_after', 1);
  END IF;
  FOREACH bucket_key IN ARRAY ARRAY['global', p_actor, p_actor || ':' || p_action] LOOP
    INSERT INTO public.ai_request_buckets AS b (key, window_start, requests) VALUES (bucket_key, stamp, 1)
    ON CONFLICT (key) DO UPDATE SET requests = b.requests + 1;
  END LOOP;
  INSERT INTO public.ai_request_leases(expires_at) VALUES (stamp + interval '30 seconds') RETURNING id INTO lease;
  RETURN jsonb_build_object('allowed', true, 'lease_id', lease);
END $$;

CREATE FUNCTION public.release_ai_request(p_lease uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM public.ai_request_leases WHERE id = p_lease;
$$;
REVOKE ALL ON FUNCTION public.acquire_ai_request(text, text, integer), public.release_ai_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_ai_request(text, text, integer), public.release_ai_request(uuid) TO service_role;
