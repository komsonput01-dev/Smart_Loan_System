/**
 * Debtors API — User management
 *
 * GET  /api/debtors       → list all debtors with their loan summary
 * POST /api/debtors       → create new debtor user record
 * GET  /api/debtors/[id]  → get debtor profile + all loans
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, loans } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

// ─── Validation ───────────────────────────────────────────────────────────────

const CreateDebtorSchema = z.object({
  clerkUserId: z.string().min(1),
  fullName: z.string().min(1, 'Name is required'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  lineUserId: z.string().optional(),
});

// ─── GET /api/debtors ─────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only
    const admin = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    if (!admin[0] || admin[0].role !== 'admin') {
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

    const [newDebtor] = await db
      .insert(users)
      .values({
        ...parsed.data,
        role: 'debtor',
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: {
          fullName: parsed.data.fullName,
          email: parsed.data.email,
          phone: parsed.data.phone,
          lineUserId: parsed.data.lineUserId,
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
