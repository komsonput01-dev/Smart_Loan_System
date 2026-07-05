/**
 * Payments API — Record loan payments with smart allocation
 *
 * POST /api/payments → record a payment (allocate interest first, then principal)
 * GET  /api/payments?loanId=xxx → payment history for a loan
 *
 * Payment Allocation Logic (ตัดยอดอัจฉริยะ):
 * 1. Calculate accrued interest up to payment date
 * 2. Apply payment → clear accrued interest first
 * 3. Remaining → reduce outstanding principal
 *
 * CRITICAL: All calculations use decimal.js to avoid floating-point errors
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loans, users, payments } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { allocatePayment } from '@/lib/payment-allocator';
import { calculateAccruedInterest } from '@/lib/interest-calculator';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── Validation ───────────────────────────────────────────────────────────────

const RecordPaymentSchema = z.object({
  loanId: z.string().uuid(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountPaid: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid monetary value'),
  note: z.string().optional(),
});

// ─── GET /api/payments ────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const loanId = searchParams.get('loanId');

    if (!loanId) {
      return NextResponse.json({ error: 'loanId is required' }, { status: 400 });
    }

    const paymentHistory = await db
      .select()
      .from(payments)
      .where(eq(payments.loanId, loanId))
      .orderBy(desc(payments.paymentDate));

    return NextResponse.json({ payments: paymentHistory });
  } catch (error) {
    console.error('[GET /api/payments]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/payments ───────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const adminUser = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    if (!adminUser[0] || adminUser[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = RecordPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { loanId, paymentDate, amountPaid: amountPaidStr, note } = parsed.data;

    // Fetch current loan state
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, loanId))
      .limit(1);

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    if (loan.status === 'closed') {
      return NextResponse.json({ error: 'Loan is already closed' }, { status: 400 });
    }

    // ── Step 1: Calculate new accrued interest up to payment date ─────────────
    const lastCalcDate = loan.lastInterestCalcDate ?? loan.startDate;
    const newInterest = calculateAccruedInterest({
      outstandingPrincipal: new Decimal(loan.outstandingPrincipal),
      interestRate: new Decimal(loan.interestRate),
      interestType: loan.interestType,
      fromDate: new Date(lastCalcDate),
      toDate: new Date(paymentDate),
      // For flat rate, pass original principal
      originalPrincipal: new Decimal(loan.principal),
    });

    const totalAccrued = new Decimal(loan.accruedInterest).plus(newInterest);
    const amountPaid = new Decimal(amountPaidStr);

    // ── Step 2: Allocate payment (interest first, then principal) ─────────────
    const allocation = allocatePayment({
      amountPaid,
      accruedInterest: totalAccrued,
      outstandingPrincipal: new Decimal(loan.outstandingPrincipal),
    });

    // ── Step 3: Determine new loan status ─────────────────────────────────────
    let newStatus: typeof loan.status = 'active';
    if (allocation.remainingPrincipal.isZero()) {
      newStatus = 'closed' as typeof loan.status;
    } else {
      const dueDate = new Date(loan.dueDate);
      const payment = new Date(paymentDate);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - payment.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDue < 0) newStatus = 'overdue';
      else if (daysUntilDue <= 3) newStatus = 'upcoming';
      else newStatus = 'active';
    }

    // ── Step 4: Persist in a transaction ──────────────────────────────────────
    // Note: Neon HTTP doesn't support native transactions, simulate with sequential ops
    // For production, use neon WebSocket driver for true transactions

    // Insert payment record
    const [newPayment] = await db.insert(payments).values({
      loanId,
      paymentDate,
      amountPaid: amountPaid.toFixed(2),
      interestPortion: allocation.interestPortion.toFixed(2),
      principalPortion: allocation.principalPortion.toFixed(2),
      remainingPrincipal: allocation.remainingPrincipal.toFixed(2),
      accruedInterestBefore: totalAccrued.toFixed(2),
      accruedInterestAfter: allocation.remainingInterest.toFixed(2),
      note,
      recordedBy: adminUser[0].id,
    }).returning();

    // Update loan state
    const [updatedLoan] = await db
      .update(loans)
      .set({
        outstandingPrincipal: allocation.remainingPrincipal.toFixed(2),
        accruedInterest: allocation.remainingInterest.toFixed(2),
        totalInterestCollected: new Decimal(loan.totalInterestCollected)
          .plus(allocation.interestPortion)
          .toFixed(2),
        lastInterestCalcDate: paymentDate,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(loans.id, loanId))
      .returning();

    return NextResponse.json({
      payment: newPayment,
      loan: updatedLoan,
      allocation: {
        amountPaid: amountPaid.toFixed(2),
        interestCleared: allocation.interestPortion.toFixed(2),
        principalReduced: allocation.principalPortion.toFixed(2),
        remainingPrincipal: allocation.remainingPrincipal.toFixed(2),
        remainingInterest: allocation.remainingInterest.toFixed(2),
        newStatus,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('[POST /api/payments]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
