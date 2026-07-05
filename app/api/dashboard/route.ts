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

    // ── 1. KPI aggregates ─────────────────────────────────────────────────────
    const kpiQuery = db
      .select({
        totalPrincipal: sql<string>`COALESCE(SUM(${loans.principal}), '0')`,
        totalOutstanding: sql<string>`COALESCE(SUM(${loans.outstandingPrincipal}), '0')`,
        totalInterestCollected: sql<string>`COALESCE(SUM(${loans.totalInterestCollected}), '0')`,
        totalLoans: sql<number>`COUNT(*)`,
        activeCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'active')`,
        upcomingCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'upcoming')`,
        overdueCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'overdue')`,
        nplCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'npl')`,
        closedCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'closed')`,
      })
      .from(loans);

    if (isDebtor) {
      kpiQuery.where(eq(loans.userId, currentUser.id));
    }

    const [kpi] = await kpiQuery;

    // ── 2. Debtor rows (one row per loan, with user info) ─────────────────────
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
      })
      .from(loans)
      .leftJoin(users, eq(loans.userId, users.id));

    if (isDebtor) {
      debtorsQuery.where(eq(loans.userId, currentUser.id));
    }

    const debtors = await debtorsQuery.orderBy(desc(loans.createdAt));

    // ── 3. Compute overdue days client-side friendly ───────────────────────────
    const today = new Date();
    const enriched = debtors.map((row) => {
      const due = new Date(row.dueDate);
      const diffMs = today.getTime() - due.getTime();
      const overdueDays = diffMs > 0 ? Math.floor(diffMs / 86_400_000) : 0;
      return { ...row, overdueDays };
    });

    return NextResponse.json({ kpi, debtors: enriched });
  } catch (error) {
    console.error('[GET /api/dashboard]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
