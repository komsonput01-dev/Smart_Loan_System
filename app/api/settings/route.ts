import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { currentUser } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const allSettings = await db.select().from(settings);
    const settingsMap = allSettings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
    return NextResponse.json(settingsMap);
  } catch (error) {
    console.error('[GET /api/settings]', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (user?.publicMetadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    
    // Validate body is an object
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Process each key-value pair
    const promises = Object.entries(body).map(async ([key, value]) => {
      if (typeof value === 'string') {
        await db
          .insert(settings)
          .values({ key, value, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value, updatedAt: new Date() }
          });
      }
    });

    await Promise.all(promises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/settings]', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
