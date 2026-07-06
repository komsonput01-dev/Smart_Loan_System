import { db } from './lib/db';
import { users } from './lib/db/schema';
import { eq, asc } from 'drizzle-orm';

async function main() {
  const duplicateEmail = 'debtor+clerk_test@demo.com';
  
  const matchedUsers = await db.select().from(users).where(eq(users.email, duplicateEmail)).orderBy(asc(users.createdAt));
  
  if (matchedUsers.length >= 2) {
    const originalUser = matchedUsers[0]; // Jul 05
    const newUser = matchedUsers[1];      // Jul 06
    
    console.log(`Original: ${originalUser.id}, clerk: ${originalUser.clerkUserId}`);
    console.log(`New: ${newUser.id}, clerk: ${newUser.clerkUserId}`);
    
    await db.delete(users).where(eq(users.id, newUser.id));
    console.log('Deleted new empty user.');
    
    await db.update(users).set({ clerkUserId: newUser.clerkUserId }).where(eq(users.id, originalUser.id));
    console.log('Updated original user clerk id.');
  } else {
    console.log('No duplicates.');
  }
  
  process.exit(0);
}

main().catch(console.error);
