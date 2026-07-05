/**
 * Neon Database Connection — Smart Loan Management System
 *
 * CRITICAL ARCHITECTURE NOTES:
 * 1. Connection Pooling: ใช้ @neondatabase/serverless ซึ่ง route ผ่าน
 *    Neon's built-in connection pooler (PgBouncer) อัตโนมัติ
 *    → ป้องกัน "too many connections" บน Vercel Serverless Functions
 *
 * 2. Cold Start Handling: neonConfig.fetchConnectionCache = true
 *    → cache WebSocket connections ระหว่าง invocations เพื่อลด cold start
 *
 * 3. Environment: ใช้ DATABASE_URL (pooled) สำหรับ runtime
 *    ใช้ DATABASE_URL_UNPOOLED สำหรับ migrations เท่านั้น
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// ── Connection Pool Configuration ─────────────────────────────────────────────

// Enable connection caching to reduce cold start latency on free tier
neonConfig.fetchConnectionCache = true;

// ── Database Client ───────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  throw new Error(
    '[SmartLoan DB] DATABASE_URL is not set. ' +
    'Please copy .env.example to .env.local and fill in your Neon connection string.'
  );
}

/**
 * Neon HTTP client — optimized for serverless (no persistent WebSocket needed)
 * Uses pooled connection string to route through PgBouncer
 */
const sql = neon(process.env.DATABASE_URL);

/**
 * Drizzle ORM instance — use this in all API routes and server components
 *
 * @example
 * import { db } from '@/lib/db';
 * import { loans } from '@/lib/db/schema';
 *
 * const allLoans = await db.select().from(loans);
 */
export const db = drizzle(sql, {
  schema,
  logger: process.env.NODE_ENV === 'development',
});

// Re-export schema for convenience
export * from './schema';
