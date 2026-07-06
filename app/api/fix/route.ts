import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, asc, and } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    const duplicateEmail = 'debtor+clerk_test@demo.com';

    const matchedUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, duplicateEmail))
      .orderBy(asc(users.createdAt));

    if (matchedUsers.length >= 2) {
      const originalUser = matchedUsers[0];
      const newUser = matchedUsers[1];

      // 1. Delete the new empty user FIRST to free up the unique clerkUserId
      await db
        .delete(users)
        .where(eq(users.id, newUser.id));

      // 2. Update original user with the new clerkUserId
      await db
        .update(users)
        .set({ clerkUserId: newUser.clerkUserId })
        .where(eq(users.id, originalUser.id));

      return NextResponse.json({ message: 'Fixed successfully' });
    }

    return NextResponse.json({ message: 'No duplicate found' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
