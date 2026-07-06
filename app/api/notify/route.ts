import { NextResponse } from 'next/server';
import { ensureUser } from '@/lib/db/ensureUser';
import { sendLinePushMessage } from '@/lib/line-notify';

export async function POST(req: Request) {
  try {
    const currentUser = await ensureUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'staff') {
      return NextResponse.json({ error: 'Admin or Staff access required' }, { status: 403 });
    }

    const body = await req.json();
    const { lineUserId, messageText } = body;

    if (!lineUserId || !messageText) {
      return NextResponse.json({ error: 'Missing lineUserId or messageText' }, { status: 400 });
    }

    const result = await sendLinePushMessage(lineUserId, messageText);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/notify]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
