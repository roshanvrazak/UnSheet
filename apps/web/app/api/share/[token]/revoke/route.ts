import { NextRequest, NextResponse } from 'next/server';
import { ShareTokenSchema } from '@unsheet/contracts';
import { revokeShareLink } from '../../../../../lib/share/store';
import { getVerifiedShareUserId, ShareAuthenticationError } from '@/lib/share/auth';
import { checkShareLookupRateLimit } from '@/lib/share/rate-limit';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const rateLimitError = checkShareLookupRateLimit(req);
  if (rateLimitError) return rateLimitError;
  try {
    const { token } = await context.params;
    const tokenParsed = ShareTokenSchema.safeParse(token);
    if (!tokenParsed.success) {
      return NextResponse.json(
        { error: 'Share link not found' },
        { status: 404 }
      );
    }

    const userId = await getVerifiedShareUserId(req);
    const managementToken = req.headers.get('x-share-management-token') || undefined;
    if (managementToken && !ShareTokenSchema.safeParse(managementToken).success) {
      return NextResponse.json({ error: 'Share link not found or unauthorized' }, { status: 404 });
    }
    const success = await revokeShareLink(token, { userId, managementToken });
    if (!success) {
      return NextResponse.json(
        { error: 'Share link not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: unknown) {
    if (e instanceof ShareAuthenticationError) {
      return NextResponse.json({ error: 'Invalid authorization' }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error: ' + message },
      { status: 500 }
    );
  }
}
