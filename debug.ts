import { db } from './lib/db';
import { users, loans } from './lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const duplicateEmail = 'debtor+clerk_test@demo.com';
  
  const allUsers = await db.select().from(users).where(eq(users.email, duplicateEmail));
  console.log(`\nFound ${allUsers.length} users with email ${duplicateEmail}:`);
  
  for (const u of allUsers) {
    console.log(`- ID: ${u.id}`);
    console.log(`  clerkUserId: ${u.clerkUserId}`);
    console.log(`  email: ${u.email}`);
    console.log(`  role: ${u.role}`);
    console.log(`  created: ${u.createdAt}`);
    
    const userLoans = await db.select().from(loans).where(eq(loans.userId, u.id));
    console.log(`  --> Loans count: ${userLoans.length}`);
  }
  
  process.exit(0);
}

main().catch(console.error);
