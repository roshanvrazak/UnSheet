-- Run on a migrated local Supabase database: psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/share_access.sql
-- All fixture writes roll back. Public role tests execute real permission checks.
BEGIN;
SET LOCAL ROLE service_role;
INSERT INTO public.share_links (share_token, title, spec, management_token_hash)
VALUES ('share_access_regression_fixture_20261008', 'Access test', '{}'::jsonb, repeat('a', 64));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.share_links WHERE share_token = 'share_access_regression_fixture_20261008') THEN
    RAISE EXCEPTION 'Server token lookup failed';
  END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM share_token, data_snapshot, management_token_hash FROM public.share_links;
    RAISE EXCEPTION 'Anonymous table enumeration was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.share_links (share_token, title, spec) VALUES ('unauthorized_insert_fixture', 'Bad insert', '{}'::jsonb);
    RAISE EXCEPTION 'Anonymous insert was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM share_token FROM public.share_links;
    RAISE EXCEPTION 'Direct authenticated enumeration was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.share_links SET is_revoked = true WHERE share_token = 'share_access_regression_fixture_20261008';
    RAISE EXCEPTION 'Direct authenticated revocation was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
