import { NextRequest, NextResponse } from 'next/server';
import { CreateShareLinkRequestSchema, CreateShareLinkResponseSchema } from '@unsheet/contracts';
import { createShareLink } from '../../../lib/share/store';
import { getVerifiedShareUserId, ShareAuthenticationError } from '@/lib/share/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateShareLinkRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload: ' + parsed.error.message },
        { status: 400 }
      );
    }

    const { title, spec, allowExport, expiresInHours, includeDataSnapshot, dataSnapshot } = parsed.data;

    const userId = await getVerifiedShareUserId(req);

    const result = await createShareLink({
      userId,
      title,
      spec,
      allowExport,
      expiresInHours,
      dataSnapshot: includeDataSnapshot ? dataSnapshot : undefined,
    });

    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host') || 'unsheet.local';
    const shareUrl = `${protocol}://${host}/share/${result.shareToken}`;

    const responsePayload = CreateShareLinkResponseSchema.parse({
      shareToken: result.shareToken,
      managementToken: result.managementToken,
      shareUrl,
      expiresAt: result.expiresAt,
    });

    return NextResponse.json(responsePayload, { status: 201, headers: { 'Cache-Control': 'no-store' } });
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
