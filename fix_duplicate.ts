import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './lib/db';
import { users } from './lib/db/schema';
import { eq, asc } from 'drizzle-orm';

async function main() {
  const duplicateEmail = 'debtor+clerk_test@demo.com';

  const matchedUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, duplicateEmail))
    .orderBy(asc(users.createdAt));

  if (matchedUsers.length >= 2) {
    const originalUser = matchedUsers[0];
    const newUser = matchedUsers[1];

    console.log(`Original User ID: ${originalUser.id}, Clerk: ${originalUser.clerkUserId}`);
    console.log(`New Empty User ID: ${newUser.id}, Clerk: ${newUser.clerkUserId}`);

    // Update original user with the new clerkUserId
    await db
      .update(users)
      .set({ clerkUserId: newUser.clerkUserId })
      .where(eq(users.id, originalUser.id));

    console.log('Updated original user with new Clerk ID.');

    // Delete the new empty user
    await db
      .delete(users)
      .where(eq(users.id, newUser.id));

    console.log('Deleted the empty duplicate user.');
  } else {
    console.log(`Found ${matchedUsers.length} users with that email. No action needed.`);
  }

  process.exit(0);
}

main().catch(console.error);
