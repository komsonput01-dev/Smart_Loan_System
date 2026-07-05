/**
 * Debtors API — User management
 *
 * GET  /api/debtors       → list all debtors with their loan summary
 * POST /api/debtors       → create new debtor user record (admin only)
 * GET  /api/debtors/[id]  → get debtor profile + all loans
 *
 * Auto-sync: uses ensureUser() so webhook misses on localhost don't break auth.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, loans } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ensureUser } from '@/lib/db/ensureUser';

// ─── Validation ───────────────────────────────────────────────────────────────

const CreateDebtorSchema = z.object({
  // clerkUserId is optional for debtors — we auto-generate a unique key if omitted
  clerkUserId: z.string().min(1).optional(),
  fullName: z.string().min(1, 'กรุณาระบุชื่อ-นามสกุล'),
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').optional().or(z.literal('')),
  phone: z.string().optional(),
  lineUserId: z.string().optional(),
  address: z.string().optional(),
  idCardNumber: z.string().optional(),
});

// ─── GET /api/debtors ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    // ensureUser syncs the Clerk session into our DB (handles webhook-miss on localhost)
    const currentUser = await ensureUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all debtors with loan aggregates
    const debtors = await db
      .select({
        id: users.id,
        clerkUserId: users.clerkUserId,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        lineUserId: users.lineUserId,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
        // Loan aggregates
        totalLoans: sql<number>`COUNT(${loans.id})`,
        totalPrincipal: sql<string>`COALESCE(SUM(${loans.principal}), '0')`,
        totalOutstanding: sql<string>`COALESCE(SUM(${loans.outstandingPrincipal}), '0')`,
        hasOverdue: sql<boolean>`BOOL_OR(${loans.status} = 'overdue')`,
        hasUpcoming: sql<boolean>`BOOL_OR(${loans.status} = 'upcoming')`,
      })
      .from(users)
      .leftJoin(loans, eq(loans.userId, users.id))
      .where(and(eq(users.role, 'debtor'), eq(users.isActive, true)))
      .groupBy(users.id)
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ debtors });
  } catch (error) {
    console.error('[GET /api/debtors]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/debtors ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // ensureUser syncs the current Clerk user into DB and auto-promotes first user to admin
    const currentUser = await ensureUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = CreateDebtorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Auto-generate a unique internal ID for debtors who don't have Clerk accounts
    const autoClerkId = parsed.data.clerkUserId ?? `debtor_${crypto.randomUUID()}`;

    const [newDebtor] = await db
      .insert(users)
      .values({
        clerkUserId: autoClerkId,
        fullName: parsed.data.fullName,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        lineUserId: parsed.data.lineUserId || null,
        role: 'debtor',
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: {
          fullName: parsed.data.fullName,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          lineUserId: parsed.data.lineUserId || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ debtor: newDebtor }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/debtors]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
