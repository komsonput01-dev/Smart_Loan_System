import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Creating settings table...');
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "settings" (
      "key" text PRIMARY KEY NOT NULL,
      "value" text NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);
  console.log('Table created!');
}

main().catch(console.error);
