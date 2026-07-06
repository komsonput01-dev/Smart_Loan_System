/**
 * Dashboard API — KPI summary + Debtor table data
 *
 * GET /api/dashboard  → returns { kpi, debtors }
 * - kpi: aggregate financial stats (filtered by user if role is debtor)
 * - debtors: flat list of loans with debtor info (filtered by user if role is debtor)
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, loans } from '@/lib/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { ensureUser } from '@/lib/db/ensureUser';

export async function GET() {
  try {
    const currentUser = await ensureUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isDebtor = currentUser.role === 'debtor';

    // ── 1. KPI aggregates (Inner join to only include active users) ────────────
    const kpiQuery = db
      .select({
        totalPrincipal: sql<string>`COALESCE(SUM(CASE WHEN ${loans.status} != 'draft' THEN ${loans.principal} ELSE 0 END), '0')`,
        totalOutstanding: sql<string>`COALESCE(SUM(CASE WHEN ${loans.status} != 'draft' THEN ${loans.outstandingPrincipal} ELSE 0 END), '0')`,
        totalInterestCollected: sql<string>`COALESCE(SUM(CASE WHEN ${loans.status} != 'draft' THEN ${loans.totalInterestCollected} ELSE 0 END), '0')`,
        totalLoans: sql<number>`COUNT(CASE WHEN ${loans.status} != 'draft' THEN ${loans.id} ELSE NULL END)`,
        activeCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'active')`,
        upcomingCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'upcoming')`,
        overdueCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'overdue')`,
        nplCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'npl')`,
        closedCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'closed')`,
        draftCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'draft')`,
      })
      .from(loans)
      .innerJoin(users, eq(loans.userId, users.id));

    if (isDebtor) {
      kpiQuery.where(
        and(
          eq(loans.userId, currentUser.id),
          eq(users.isActive, true),
          sql`${loans.status} != 'draft'`
        )
      );
    } else {
      kpiQuery.where(eq(users.isActive, true));
    }

    const [kpi] = await kpiQuery;

    // ── 2. Debtor rows (one row per loan, with active user info) ─────────────
    const debtorsQuery = db
      .select({
        // Loan identity
        loanId: loans.id,
        note: loans.note,
        // User info
        userId: users.id,
        name: users.fullName,
        phone: users.phone,
        lineUserId: users.lineUserId,
        // Financials
        principal: loans.principal,
        outstanding: loans.outstandingPrincipal,
        accruedInterest: loans.accruedInterest,
        totalInterestCollected: loans.totalInterestCollected,
        interestRate: loans.interestRate,
        interestType: loans.interestType,
        // Dates & status
        startDate: loans.startDate,
        dueDate: loans.dueDate,
        status: loans.status,
        lastInterestCalcDate: loans.lastInterestCalcDate,
      })
      .from(loans)
      .innerJoin(users, eq(loans.userId, users.id)); // Use innerJoin to hide loans of soft-deleted debtors

    if (isDebtor) {
      debtorsQuery.where(
        and(
          eq(loans.userId, currentUser.id),
          eq(users.isActive, true),
          sql`${loans.status} != 'draft'`
        )
      );
    } else {
      debtorsQuery.where(eq(users.isActive, true));
    }

    const debtors = await debtorsQuery.orderBy(desc(loans.createdAt));

    // ── 3. Compute overdue days and real-time interest client-side friendly ─────────
    const { calculateCurrentAccruedInterest } = await import('@/lib/interest-calculator');
    const today = new Date();

    const enriched = debtors.map((row) => {
      const due = new Date(row.dueDate);
      const diffMs = today.getTime() - due.getTime();
      const overdueDays = diffMs > 0 ? Math.floor(diffMs / 86_400_000) : 0;

      const currentInterest = calculateCurrentAccruedInterest({
        outstandingPrincipal: row.outstanding,
        originalPrincipal: row.principal,
        interestRate: row.interestRate,
        interestType: row.interestType as any,
        lastInterestCalcDate: row.lastInterestCalcDate,
        startDate: row.startDate,
        existingAccruedInterest: row.accruedInterest,
        dueDate: row.dueDate,
      });

      return { 
        ...row, 
        overdueDays,
        currentNormalAccrued: currentInterest.normalAccrued.toNumber(),
        currentPenaltyAccrued: currentInterest.penaltyAccrued.toNumber(),
      };
    });

    const charts = {
      loanStatus: [
        { name: 'ปกติ', value: Number(kpi.activeCount), color: '#10b981' },
        { name: 'ใกล้กำหนด', value: Number(kpi.upcomingCount), color: '#f59e0b' },
        { name: 'เกินกำหนด', value: Number(kpi.overdueCount), color: '#f97316' },
        { name: 'หนี้เสีย', value: Number(kpi.nplCount), color: '#ef4444' }
      ].filter(item => item.value > 0), // Hide zero values in donut
      debtAging: [
        { range: '1-30 วัน', amount: 0 },
        { range: '31-60 วัน', amount: 0 },
        { range: '61-90 วัน', amount: 0 },
        { range: '> 90 วัน', amount: 0 }
      ]
    };

    enriched.forEach(row => {
      if (row.overdueDays > 0 && row.status !== 'closed' && row.status !== 'draft') {
        const p = Number(row.outstanding);
        if (row.overdueDays <= 30) charts.debtAging[0].amount += p;
        else if (row.overdueDays <= 60) charts.debtAging[1].amount += p;
        else if (row.overdueDays <= 90) charts.debtAging[2].amount += p;
        else charts.debtAging[3].amount += p;
      }
    });

    return NextResponse.json({ kpi, debtors: enriched, charts });
  } catch (error) {
    console.error('[GET /api/dashboard]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
