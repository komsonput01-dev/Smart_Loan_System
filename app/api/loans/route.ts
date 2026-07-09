/**
 * Loans API — CRUD operations
 *
 * GET  /api/loans          → list loans (with filters)
 * POST /api/loans          → create new loan
 * GET  /api/loans/[id]     → get single loan with payments
 * PATCH /api/loans/[id]    → update loan
 *
 * All routes require Clerk authentication.
 * Admin role required for write operations.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loans, users } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ensureUser } from '@/lib/db/ensureUser';
import { calculateComputedLoanStatus } from '@/lib/interest-calculator';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const CreateLoanSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  principal: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format'),
  interestRate: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid rate format'),
  interestType: z.enum(['flat_daily', 'flat_monthly', 'effective_daily', 'effective_monthly']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  note: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankName: z.string().optional(),
});

// ─── GET /api/loans ───────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const currentUser = await ensureUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const offset = (page - 1) * limit;

    const isDebtor = currentUser.role === 'debtor';

    // Build where conditions
    const conditions = [];
    if (isDebtor) {
      conditions.push(eq(loans.userId, currentUser.id));
      conditions.push(sql`${loans.status} != 'draft'`);
    }
    if (status && status !== 'all') {
      conditions.push(eq(loans.status, status as any));
    }

    // Fetch loans with user info
    const loansData = await db
      .select({
        id: loans.id,
        userId: loans.userId,
        principal: loans.principal,
        outstandingPrincipal: loans.outstandingPrincipal,
        accruedInterest: loans.accruedInterest,
        totalInterestCollected: loans.totalInterestCollected,
        interestRate: loans.interestRate,
        interestType: loans.interestType,
        startDate: loans.startDate,
        dueDate: loans.dueDate,
        lastInterestCalcDate: loans.lastInterestCalcDate,
        status: loans.status,
        note: loans.note,
        bankAccountName: loans.bankAccountName,
        bankAccountNumber: loans.bankAccountNumber,
        bankName: loans.bankName,
        createdAt: loans.createdAt,
        // User info
        userName: users.fullName,
        userEmail: users.email,
        userPhone: users.phone,
        userLineId: users.lineUserId,
      })
      .from(loans)
      .leftJoin(users, eq(loans.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(loans.createdAt))
      .limit(limit)
      .offset(offset);

    // Get KPI summary
    const kpiQuery = db
      .select({
        totalPrincipal: sql<string>`COALESCE(SUM(CASE WHEN ${loans.status} != 'draft' THEN ${loans.principal} ELSE 0 END), 0)`,
        totalOutstanding: sql<string>`COALESCE(SUM(CASE WHEN ${loans.status} != 'draft' THEN ${loans.outstandingPrincipal} ELSE 0 END), 0)`,
        totalInterestCollected: sql<string>`COALESCE(SUM(CASE WHEN ${loans.status} != 'draft' THEN ${loans.totalInterestCollected} ELSE 0 END), 0)`,
        totalLoans: sql<number>`COUNT(CASE WHEN ${loans.status} != 'draft' THEN ${loans.id} ELSE NULL END)`,
        activeCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'active')`,
        upcomingCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'upcoming')`,
        overdueCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'overdue')`,
        nplCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'npl')`,
      })
      .from(loans);

    if (isDebtor) {
      kpiQuery.where(eq(loans.userId, currentUser.id));
    }

    const kpiData = await kpiQuery;

    // Map dynamic status
    const enrichedLoans = loansData.map(loan => {
      const computedStatus = calculateComputedLoanStatus({
        status: loan.status,
        dueDate: loan.dueDate,
        outstandingPrincipal: loan.outstandingPrincipal,
      });
      return {
        ...loan,
        status: computedStatus,
      };
    });

    return NextResponse.json({
      loans: enrichedLoans,
      kpi: kpiData[0],
      pagination: {
        page,
        limit,
        total: Number(kpiData[0]?.totalLoans ?? 0),
      },
    });
  } catch (error) {
    console.error('[GET /api/loans]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/loans ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const currentUser = await ensureUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin or staff role
    if (currentUser.role !== 'admin' && currentUser.role !== 'staff') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = CreateLoanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate dates
    const start = new Date(data.startDate);
    const due = new Date(data.dueDate);
    if (due <= start) {
      return NextResponse.json(
        { error: 'Due date must be after start date' },
        { status: 400 }
      );
    }

    // Determine status & approval metadata based on role
    const isStaff = currentUser.role === 'staff';
    const status = isStaff ? 'draft' : 'active';
    const approvedBy = isStaff ? null : currentUser.id;

    // Create loan — principal == outstandingPrincipal on creation
    const [newLoan] = await db
      .insert(loans)
      .values({
        userId: data.userId,
        principal: data.principal,
        outstandingPrincipal: data.principal, // เริ่มต้นด้วยเงินต้นทั้งก้อน
        accruedInterest: '0',
        totalInterestCollected: '0',
        interestRate: data.interestRate,
        interestType: data.interestType,
        startDate: data.startDate,
        dueDate: data.dueDate,
        lastInterestCalcDate: data.startDate,
        status: status as any,
        note: data.note,
        bankAccountName: data.bankAccountName,
        bankAccountNumber: data.bankAccountNumber,
        bankName: data.bankName,
        createdBy: currentUser.id,
        approvedBy: approvedBy,
      })
      .returning();

    return NextResponse.json({ loan: newLoan }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/loans]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
