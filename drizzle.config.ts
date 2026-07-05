import type { Config } from 'drizzle-kit';
import { loadEnvConfig } from '@next/env';

// Load env variables from .env.local
loadEnvConfig(process.cwd());

/**
 * Drizzle Kit Configuration
 *
 * Commands:
 *   npx drizzle-kit generate  — สร้าง migration files จาก schema
 *   npx drizzle-kit push      — push schema โดยตรงไปยัง DB (dev only)
 *   npx drizzle-kit studio    — เปิด Drizzle Studio (DB GUI)
 *   npx drizzle-kit migrate   — รัน migration files
 */
export default {
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // ใช้ unpooled connection สำหรับ DDL operations
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
  // Verbose logging during migration
  verbose: true,
  // Strict mode — require explicit confirmation for destructive operations
  strict: true,
} satisfies Config;
