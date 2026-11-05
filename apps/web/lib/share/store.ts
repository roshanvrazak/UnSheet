import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DashboardSpec } from '@unsheet/contracts';
import { generateShareToken, hashManagementToken, matchesManagementToken } from './token';

export interface ShareLinkRecord {
  id: string;
  user_id: string | null;
  share_token: string;
  management_token_hash: string | null;
  title: string;
  spec: DashboardSpec;
  allow_export: boolean;
  data_snapshot: Record<string, unknown>[] | null;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

// Demo-only store when no Supabase URL is configured.
const memoryStore = new Map<string, ShareLinkRecord>();

let supabaseClient: SupabaseClient | null = null;

export function getShareSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Sharing requires SUPABASE_SERVICE_ROLE_KEY when Supabase is configured');
  supabaseClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return supabaseClient;
}

export interface CreateShareLinkOptions {
  userId?: string | null | undefined;
  title: string;
  spec: DashboardSpec;
  allowExport?: boolean | undefined;
  expiresInHours?: number | undefined;
  dataSnapshot?: Record<string, unknown>[] | undefined;
}

export async function createShareLink(options: CreateShareLinkOptions): Promise<{ shareToken: string; managementToken?: string | undefined; expiresAt?: string | undefined }> {
  const shareToken = generateShareToken();
  const managementToken = options.userId ? undefined : generateShareToken();
  const now = new Date();
  let expiresAt: Date | undefined;
  
  if (options.expiresInHours && options.expiresInHours > 0) {
    expiresAt = new Date(now.getTime() + options.expiresInHours * 60 * 60 * 1000);
  }

  const record: ShareLinkRecord = {
    id: crypto.randomUUID(),
    user_id: options.userId || null,
    share_token: shareToken,
    management_token_hash: managementToken ? hashManagementToken(managementToken) : null,
    title: options.title,
    spec: options.spec,
    allow_export: options.allowExport ?? false,
    data_snapshot: options.dataSnapshot || null,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    is_revoked: false,
    created_at: now.toISOString(),
  };

  const supabase = getShareSupabase();
  if (supabase) {
    const { error } = await supabase.from('share_links').insert({
      id: record.id,
      user_id: record.user_id,
      share_token: record.share_token,
      management_token_hash: record.management_token_hash,
      title: record.title,
      spec: record.spec,
      allow_export: record.allow_export,
      data_snapshot: record.data_snapshot,
      expires_at: record.expires_at,
      is_revoked: record.is_revoked,
      created_at: record.created_at,
    });

    if (error) {
      console.error('Supabase error creating share link:', error);
      throw new Error('Unable to persist share link');
    }
  } else {
    memoryStore.set(shareToken, record);
  }

  return {
    shareToken,
    managementToken,
    expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
  };
}

export async function getShareLinkByToken(token: string): Promise<ShareLinkRecord | null> {
  const supabase = getShareSupabase();
  let record: ShareLinkRecord | null = null;

  if (supabase) {
    const { data, error } = await supabase
      .from('share_links')
      .select('*')
      .eq('share_token', token)
      .single();

    if (!error && data) {
      record = data as ShareLinkRecord;
    }
  }

  if (!record) {
    record = memoryStore.get(token) || null;
  }

  if (!record) {
    return null;
  }

  // Check revocation and expiration
  if (record.is_revoked) {
    return null;
  }

  if (record.expires_at) {
    const expires = new Date(record.expires_at);
    if (expires.getTime() <= Date.now()) {
      return null;
    }
  }

  return record;
}

export interface ShareManagementCredentials {
  userId?: string | null | undefined;
  managementToken?: string | undefined;
}

export async function revokeShareLink(token: string, credentials: ShareManagementCredentials = {}): Promise<boolean> {
  const { userId, managementToken } = credentials;
  if (!userId && !managementToken) return false;
  const supabase = getShareSupabase();
  if (supabase) {
    let query = supabase.from('share_links').update({ is_revoked: true }).eq('share_token', token);
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null).eq('management_token_hash', hashManagementToken(managementToken!));
    }
    const { data, error } = await query.select('id');
    if (error) throw new Error('Unable to revoke share link');
    return Boolean(data?.length);
  }
  const record = memoryStore.get(token);
  if (!record) return false;
  const authorized = userId
    ? record.user_id === userId
    : Boolean(!record.user_id && managementToken && record.management_token_hash && matchesManagementToken(managementToken, record.management_token_hash));
  if (!authorized) return false;
  record.is_revoked = true;
  return true;
}
