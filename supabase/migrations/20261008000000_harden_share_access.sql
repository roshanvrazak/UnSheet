-- Public share access and management go through server routes using service-role credentials.
-- Existing anonymous links remain viewable, but have no management secret to recover.
ALTER TABLE public.share_links ADD COLUMN IF NOT EXISTS management_token_hash text;

DROP POLICY IF EXISTS "Public read active share links" ON public.share_links;
DROP POLICY IF EXISTS "Users or system can insert share links" ON public.share_links;
DROP POLICY IF EXISTS "Users can update own share links" ON public.share_links;
DROP POLICY IF EXISTS "Users can delete own share links" ON public.share_links;

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.share_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.share_links TO service_role;
