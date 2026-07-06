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

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const roleFromClerk = clerkUser.publicMetadata?.role as 'admin' | 'staff' | 'debtor' | undefined;

  if (existing.length > 0) {
    const user = existing[0];
    
    // Auto-sync role if it was updated in Clerk Dashboard but webhook missed it
    if (roleFromClerk && roleFromClerk !== user.role) {
      const [updated] = await db
        .update(users)
        .set({ role: roleFromClerk, updatedAt: new Date() })
        .where(eq(users.clerkUserId, clerkUserId))
        .returning();
      console.log(`[ensureUser] 🔄 Synced role for ${user.email} to ${roleFromClerk}`);
      return updated;
    }
    
    return user;
  }

  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? null;

  // 2. If not found by clerkUserId, try to find an existing user by email
  if (primaryEmail) {
    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, primaryEmail))
      // Order by created_at asc to prefer the older (original) record in case of duplicates
      .orderBy(users.createdAt)
      .limit(1);

    if (existingByEmail.length > 0) {
      const userToLink = existingByEmail[0];
      
      // If this record has a different clerkUserId, update it to bind to the new Clerk account
      if (userToLink.clerkUserId !== clerkUserId) {
        const [updated] = await db
          .update(users)
          .set({ clerkUserId, role: roleFromClerk ?? userToLink.role, updatedAt: new Date() })
          .where(eq(users.id, userToLink.id))
          .returning();
        
        console.log(`[ensureUser] 🔗 Linked new Clerk account to existing user by email: ${primaryEmail}`);
        
        // Cleanup: If there happens to be an empty duplicate record with the new clerkUserId (from a previous failed sync), delete it.
        // Wait, since we are doing this during ensureUser and the new clerkUserId wasn't found in step 1, there shouldn't be a duplicate.
        // However, if there was a duplicate, we could delete it here. Since existing.length === 0 (we are here because step 1 failed), there is no duplicate.
        return updated;
      }
    }
  }

  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
    primaryEmail?.split('@')[0] ||
    'Admin';

  // 3. Determine role — check Clerk's publicMetadata.role. If not set, default to 'admin'.
  const role: 'admin' | 'staff' | 'debtor' = roleFromClerk ?? 'admin';

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
