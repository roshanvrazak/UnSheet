import { getShareSupabase } from './store';

export class ShareAuthenticationError extends Error {}

/** Supabase verifies the bearer token; caller-supplied user IDs are never trusted. */
export async function getVerifiedShareUserId(req: Request): Promise<string | null> {
  const authorization = req.headers.get('authorization');
  if (!authorization) return null;
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match) throw new ShareAuthenticationError('Invalid authorization');
  const supabase = getShareSupabase();
  if (!supabase) throw new ShareAuthenticationError('Authentication unavailable');
  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error || !data.user) throw new ShareAuthenticationError('Invalid authorization');
  return data.user.id;
}
