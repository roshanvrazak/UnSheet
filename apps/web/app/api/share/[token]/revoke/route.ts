import { NextRequest, NextResponse } from 'next/server';
import { ShareTokenSchema } from '@unsheet/contracts';
import { revokeShareLink } from '../../../../../lib/share/store';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const tokenParsed = ShareTokenSchema.safeParse(token);
    if (!tokenParsed.success) {
      return NextResponse.json(
        { error: 'Share link not found' },
        { status: 404 }
      );
    }

    const authHeader = req.headers.get('authorization');
    const userId: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Extract user ID if provided
    }

    const success = await revokeShareLink(token, userId);
    if (!success) {
      return NextResponse.json(
        { error: 'Share link not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error: ' + message },
      { status: 500 }
    );
  }
}
