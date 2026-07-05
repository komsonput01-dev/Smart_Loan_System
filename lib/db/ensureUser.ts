/**
 * ensureUser — Auto-sync the currently authenticated Clerk user to our DB.
 *
 * On localhost (development), Clerk webhooks cannot reach us, so user records
 * are never created via the webhook flow. This helper is the fallback — call it
 * at the top of any authenticated API route to guarantee the user exists in our DB.
 *
 * Behaviour:
 *  • If the user already exists → no-op (returns existing record)
 *  • If the user is new → inserts them with role = 'admin' IF no admins exist yet
 *    (bootstrap mode for the very first sign-in), otherwise role = 'debtor'
 *  • On conflict (race condition) → upserts safely
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { User } from '@/lib/db/schema';

export async function ensureUser(): Promise<User | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  // 1. Check if user already exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  // 2. User not in DB yet — fetch details from Clerk
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? null;

  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
    primaryEmail?.split('@')[0] ||
    'Admin';

  // 3. Determine role — first user in system becomes admin (bootstrap)
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(eq(users.role, 'admin'));

  const role: 'admin' | 'debtor' = Number(count) === 0 ? 'admin' : 'debtor';

  // 4. Upsert (safe against race conditions)
  const [created] = await db
    .insert(users)
    .values({
      clerkUserId,
      fullName,
      email: primaryEmail,
      avatarUrl: clerkUser.imageUrl ?? null,
      role,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        fullName,
        email: primaryEmail,
        avatarUrl: clerkUser.imageUrl ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  console.log(`[ensureUser] ✅ User synced: ${clerkUserId} → role=${role}`);
  return created;
}
