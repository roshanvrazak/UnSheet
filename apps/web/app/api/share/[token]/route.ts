import { NextRequest, NextResponse } from 'next/server';
import { GetShareLinkResponseSchema, ShareTokenSchema } from '@unsheet/contracts';
import { getShareLinkByToken } from '../../../../lib/share/store';
import { checkShareLookupRateLimit } from '../../../../lib/share/rate-limit';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  // 1. Rate limiting
  const rateLimitError = checkShareLookupRateLimit(req);
  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const { token } = await context.params;

    // Validate token format before querying to prevent malformed injections
    const tokenParsed = ShareTokenSchema.safeParse(token);
    if (!tokenParsed.success) {
      // Threat model requirement: Return IDENTICAL response for missing, expired, revoked, or malformed tokens
      return NextResponse.json(
        { error: 'Share link not found or expired' },
        { status: 404 }
      );
    }

    const record = await getShareLinkByToken(token);

    if (!record) {
      // Crucial threat model requirement: IDENTICAL response for missing, expired, or revoked tokens (prevents oracle enumeration)
      return NextResponse.json(
        { error: 'Share link not found or expired' },
        { status: 404 }
      );
    }

    const responsePayload = GetShareLinkResponseSchema.parse({
      title: record.title,
      spec: record.spec,
      allowExport: record.allow_export,
      createdAt: record.created_at,
      expiresAt: record.expires_at || undefined,
      dataSnapshot: record.data_snapshot || undefined,
    });

    return NextResponse.json(responsePayload, { status: 200 });
  } catch {
    // Also return identical 404 on unexpected lookup failures to prevent error-based enumeration oracles
    return NextResponse.json(
      { error: 'Share link not found or expired' },
      { status: 404 }
    );
  }
}
