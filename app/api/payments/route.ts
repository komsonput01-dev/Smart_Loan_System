/**
 * Payments API — Record loan payments with smart allocation
 *
 * POST /api/payments → record a payment (allocate penalty first, then interest, then principal)
 * GET  /api/payments[?loanId=xxx] → payment history for a loan or all payments
 *
 * Payment Allocation Logic (ตัดยอดอัจฉริยะ):
 * 1. Calculate accrued interest and penalty up to payment date
 * 2. Apply payment → clear penalty interest first
 * 3. Then clear normal accrued interest
 * 4. Remaining → reduce outstanding principal
 *
 * CRITICAL: All calculations use decimal.js to avoid floating-point errors
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loans, users, payments } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { allocatePayment } from '@/lib/payment-allocator';
import { calculateAccruedInterest, calculatePenaltyInterest } from '@/lib/interest-calculator';
import { ensureUser } from '@/lib/db/ensureUser';

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
    const currentUser = await ensureUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const loanId = searchParams.get('loanId');

    if (loanId) {
      // Fetch history for a specific loan
      const paymentHistory = await db
        .select({
          id: payments.id,
          loanId: payments.loanId,
          paymentDate: payments.paymentDate,
          amountPaid: payments.amountPaid,
          penaltyPortion: payments.penaltyPortion,
          interestPortion: payments.interestPortion,
          principalPortion: payments.principalPortion,
          remainingPrincipal: payments.remainingPrincipal,
          accruedInterestBefore: payments.accruedInterestBefore,
          accruedInterestAfter: payments.accruedInterestAfter,
          note: payments.note,
          recordedBy: payments.recordedBy,
          createdAt: payments.createdAt,
          // Join details
          loanRef: loans.note,
          debtorName: users.fullName,
        })
        .from(payments)
        .leftJoin(loans, eq(payments.loanId, loans.id))
        .leftJoin(users, eq(loans.userId, users.id))
        .where(eq(payments.loanId, loanId))
        .orderBy(desc(payments.paymentDate), desc(payments.createdAt));

      return NextResponse.json({ payments: paymentHistory });
    } else {
      // Fetch all payments in the system (for global list)
      const paymentHistory = await db
        .select({
          id: payments.id,
          loanId: payments.loanId,
          paymentDate: payments.paymentDate,
          amountPaid: payments.amountPaid,
          penaltyPortion: payments.penaltyPortion,
          interestPortion: payments.interestPortion,
          principalPortion: payments.principalPortion,
          remainingPrincipal: payments.remainingPrincipal,
          accruedInterestBefore: payments.accruedInterestBefore,
          accruedInterestAfter: payments.accruedInterestAfter,
          note: payments.note,
          recordedBy: payments.recordedBy,
          createdAt: payments.createdAt,
          // Join details
          loanRef: loans.note,
          debtorName: users.fullName,
        })
        .from(payments)
        .leftJoin(loans, eq(payments.loanId, loans.id))
        .leftJoin(users, eq(loans.userId, users.id))
        .orderBy(desc(payments.paymentDate), desc(payments.createdAt));

      return NextResponse.json({ payments: paymentHistory });
    }
  } catch (error) {
    console.error('[GET /api/payments]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/payments ───────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const currentUser = await ensureUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    if (currentUser.role !== 'admin') {
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

    // 🔒 Security Check 1: Prevent retroactive out-of-order payments
    const [latestPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.loanId, loanId))
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
      .limit(1);

    if (latestPayment && new Date(paymentDate) < new Date(latestPayment.paymentDate)) {
      return NextResponse.json(
        { error: `ไม่สามารถบันทึกการชำระเงินย้อนหลังได้ วันที่ชำระต้องไม่ก่อนวันที่ชำระล่าสุด (${new Date(latestPayment.paymentDate).toLocaleDateString('th-TH')})` },
        { status: 400 }
      );
    }

    // 🔒 Security Check 2: Prevent payment before loan start date
    if (new Date(paymentDate) < new Date(loan.startDate)) {
      return NextResponse.json(
        { error: `ไม่สามารถบันทึกการชำระเงินก่อนวันที่เริ่มสัญญาได้ (${new Date(loan.startDate).toLocaleDateString('th-TH')})` },
        { status: 400 }
      );
    }

    // ── Step 1: Calculate new accrued interest and penalty up to payment date ─────
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

    // Calculate penalty interest (15%/year) if payment is overdue
    const penaltyInterest = calculatePenaltyInterest(
      new Decimal(loan.outstandingPrincipal),
      loan.dueDate,
      new Date(paymentDate)
    );

    const totalAccrued = new Decimal(loan.accruedInterest).plus(newInterest);
    const amountPaid = new Decimal(amountPaidStr);

    // ── Step 2: Allocate payment (penalty first, then interest, then principal) ──
    const allocation = allocatePayment({
      amountPaid,
      accruedInterest: totalAccrued,
      outstandingPrincipal: new Decimal(loan.outstandingPrincipal),
      penaltyInterest,
    });

    // ── Step 3: Determine new loan status ─────────────────────────────────────
    let newStatus: typeof loan.status = 'active';
    if (allocation.remainingPrincipal.isZero()) {
      newStatus = 'closed';
    } else {
      const dueDate = new Date(loan.dueDate);
      const payment = new Date(paymentDate);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - payment.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDue < 0) {
        // If overdue by > 90 days, classify as NPL
        if (Math.abs(daysUntilDue) > 90) {
          newStatus = 'npl';
        } else {
          newStatus = 'overdue';
        }
      } else if (daysUntilDue <= 3) {
        newStatus = 'upcoming';
      } else {
        newStatus = 'active';
      }
    }

    // ── Step 4: Persist in a transaction ──────────────────────────────────────
    // Insert payment record
    const [newPayment] = await db.insert(payments).values({
      loanId,
      paymentDate,
      amountPaid: amountPaid.toFixed(2),
      penaltyPortion: allocation.penaltyPortion.toFixed(2),
      interestPortion: allocation.interestPortion.toFixed(2),
      principalPortion: allocation.principalPortion.toFixed(2),
      remainingPrincipal: allocation.remainingPrincipal.toFixed(2),
      accruedInterestBefore: totalAccrued.toFixed(2),
      accruedInterestAfter: allocation.remainingInterest.toFixed(2),
      note,
      recordedBy: currentUser.id,
    }).returning();

    // Update loan state
    const [updatedLoan] = await db
      .update(loans)
      .set({
        outstandingPrincipal: allocation.remainingPrincipal.toFixed(2),
        accruedInterest: allocation.remainingInterest.toFixed(2),
        totalInterestCollected: new Decimal(loan.totalInterestCollected)
          .plus(allocation.interestPortion)
          .plus(allocation.penaltyPortion)
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
        penaltyCleared: allocation.penaltyPortion.toFixed(2),
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
