-- Phase 6 Migration: Templates and Share Links with RLS

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Templates table
CREATE TABLE IF NOT EXISTS templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    spec jsonb NOT NULL,
    fingerprint jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Share links table
CREATE TABLE IF NOT EXISTS share_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    share_token text UNIQUE NOT NULL,
    title text NOT NULL,
    spec jsonb NOT NULL,
    allow_export boolean NOT NULL DEFAULT false,
    data_snapshot jsonb,
    expires_at timestamptz,
    is_revoked boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links (share_token);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates (user_id);

-- 4. Enable Row Level Security
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for templates
-- Users can only manage their own templates
CREATE POLICY "Users can select own templates"
    ON templates FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
    ON templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
    ON templates FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
    ON templates FOR DELETE
    USING (auth.uid() = user_id);

-- 6. RLS Policies for share_links
-- Public read on non-revoked and unexpired links
CREATE POLICY "Public read active share links"
    ON share_links FOR SELECT
    USING (
        (is_revoked = false) AND (expires_at IS NULL OR expires_at > now())
    );

-- Insert: auth.uid() = user_id OR anonymous if server-generated
CREATE POLICY "Users or system can insert share links"
    ON share_links FOR INSERT
    WITH CHECK (
        auth.uid() = user_id OR user_id IS NULL OR auth.uid() IS NULL
    );

-- Update and Delete: Owner only
CREATE POLICY "Users can update own share links"
    ON share_links FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own share links"
    ON share_links FOR DELETE
    USING (auth.uid() = user_id);
