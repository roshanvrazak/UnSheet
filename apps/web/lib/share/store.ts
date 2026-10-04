import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DashboardSpec } from '@unsheet/contracts';
import { generateShareToken } from './token';

export interface ShareLinkRecord {
  id: string;
  user_id: string | null;
  share_token: string;
  title: string;
  spec: DashboardSpec;
  allow_export: boolean;
  data_snapshot: Record<string, unknown>[] | null;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

// In-memory fallback store for offline/demo mode or when Supabase credentials are absent
const memoryStore = new Map<string, ShareLinkRecord>();

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (url && key) {
    try {
      supabaseClient = createClient(url, key, {
        auth: { persistSession: false },
      });
      return supabaseClient;
    } catch (e) {
      console.warn('Failed to initialize Supabase client in store:', e);
    }
  }
  return null;
}

export interface CreateShareLinkOptions {
  userId?: string | null | undefined;
  title: string;
  spec: DashboardSpec;
  allowExport?: boolean | undefined;
  expiresInHours?: number | undefined;
  dataSnapshot?: Record<string, unknown>[] | undefined;
}

export async function createShareLink(options: CreateShareLinkOptions): Promise<{ shareToken: string; expiresAt?: string | undefined }> {
  const shareToken = generateShareToken();
  const now = new Date();
  let expiresAt: Date | undefined;
  
  if (options.expiresInHours && options.expiresInHours > 0) {
    expiresAt = new Date(now.getTime() + options.expiresInHours * 60 * 60 * 1000);
  }

  const record: ShareLinkRecord = {
    id: crypto.randomUUID(),
    user_id: options.userId || null,
    share_token: shareToken,
    title: options.title,
    spec: options.spec,
    allow_export: options.allowExport ?? false,
    data_snapshot: options.dataSnapshot || null,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    is_revoked: false,
    created_at: now.toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from('share_links').insert({
      id: record.id,
      user_id: record.user_id,
      share_token: record.share_token,
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
      // Fall back to memory store if Supabase insert fails (e.g., table not migrated yet in test environment)
      memoryStore.set(shareToken, record);
    }
  } else {
    memoryStore.set(shareToken, record);
  }

  return {
    shareToken,
    expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
  };
}

export async function getShareLinkByToken(token: string): Promise<ShareLinkRecord | null> {
  const supabase = getSupabase();
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

export async function revokeShareLink(token: string, userId?: string | null): Promise<boolean> {
  const supabase = getSupabase();
  
  if (supabase) {
    let query = supabase
      .from('share_links')
      .update({ is_revoked: true })
      .eq('share_token', token);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { error } = await query.select();
    if (!error) {
      // Also update memory store if present
      const mem = memoryStore.get(token);
      if (mem) {
        mem.is_revoked = true;
        memoryStore.set(token, mem);
      }
      return true;
    }
  }

  const mem = memoryStore.get(token);
  if (mem) {
    if (userId && mem.user_id && mem.user_id !== userId) {
      return false; // Unauthorized
    }
    mem.is_revoked = true;
    memoryStore.set(token, mem);
    return true;
  }

  return false;
}
