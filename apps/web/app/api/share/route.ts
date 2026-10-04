import { NextRequest, NextResponse } from 'next/server';
import { CreateShareLinkRequestSchema, CreateShareLinkResponseSchema } from '@unsheet/contracts';
import { createShareLink } from '../../../lib/share/store';

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

    // Optional user ID from auth headers or session if present
    const authHeader = req.headers.get('authorization');
    const userId: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // In production with Supabase JWT, this would be decoded or verified. For now we accept or leave null for anonymous.
    }

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
      shareUrl,
      expiresAt: result.expiresAt,
    });

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error: ' + message },
      { status: 500 }
    );
  }
}
