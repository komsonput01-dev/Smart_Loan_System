import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { migrate } from 'drizzle-orm/neon-http/migrator';

/**
 * Migration runner — ใช้ DATABASE_URL_UNPOOLED (direct connection)
 * เพราะ PgBouncer ไม่รองรับ DDL statements ใน transaction mode
 *
 * Usage: npx tsx lib/db/migrate.ts
 */
async function runMigrations() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL must be set for migrations');
  }

  console.log('🔗 Connecting to Neon (unpooled)...');
  const sql = neon(connectionString);
  const db = drizzle(sql);

  console.log('⏳ Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('✅ Migrations completed successfully!');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
