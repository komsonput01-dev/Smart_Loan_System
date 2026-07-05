/**
 * Export API Route — Smart Loan Management System
 *
 * Route: GET /api/export
 * Retrieves aggregated financial metrics for 'Summary' tab
 * and granular loan/payment records for 'Raw_Data' tab.
 *
 * Financial calculations are performed using decimal.js to guarantee precision.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loans, users, payments } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 1. Fetch Aggregated Metrics for 'Summary' ───────────────────────────
    const rawMetrics = await db
      .select({
        totalPrincipal: sql<string>`COALESCE(SUM(${loans.principal}), '0')`,
        totalOutstanding: sql<string>`COALESCE(SUM(${loans.outstandingPrincipal}), '0')`,
        totalInterestCollected: sql<string>`COALESCE(SUM(${loans.totalInterestCollected}), '0')`,
        totalLoans: sql<number>`COUNT(*)`,
        nplPrincipal: sql<string>`COALESCE(SUM(${loans.outstandingPrincipal}) FILTER (WHERE ${loans.status} = 'npl'), '0')`,
      })
      .from(loans)
      .limit(1);

    const metrics = rawMetrics[0] || {
      totalPrincipal: '0',
      totalOutstanding: '0',
      totalInterestCollected: '0',
      totalLoans: 0,
      nplPrincipal: '0',
    };

    const totalOutstandingDec = new Decimal(metrics.totalOutstanding);
    const nplPrincipalDec = new Decimal(metrics.nplPrincipal);

    // Calculate NPL Ratio precisely: (NPL Principal / Total Outstanding) * 100
    const nplRatio = totalOutstandingDec.isZero()
      ? new Decimal('0.00')
      : nplPrincipalDec.div(totalOutstandingDec).mul(100).toDecimalPlaces(2);

    const summaryData = {
      totalPrincipal: new Decimal(metrics.totalPrincipal).toFixed(2),
      totalOutstanding: totalOutstandingDec.toFixed(2),
      totalInterestCollected: new Decimal(metrics.totalInterestCollected).toFixed(2),
      totalLoans: metrics.totalLoans,
      nplPrincipal: nplPrincipalDec.toFixed(2),
      nplRatio: nplRatio.toFixed(2),
    };

    // ── 2. Fetch Granular Data for 'Raw_Data' (Pivot Table Ready) ────────────
    const rawData = await db
      .select({
        loanId: loans.id,
        debtorName: users.fullName,
        debtorPhone: users.phone,
        debtorEmail: users.email,
        debtorLineId: users.lineUserId,
        principal: loans.principal,
        outstandingPrincipal: loans.outstandingPrincipal,
        accruedInterest: loans.accruedInterest,
        totalInterestCollected: loans.totalInterestCollected,
        interestRate: loans.interestRate,
        interestType: loans.interestType,
        status: loans.status,
        startDate: loans.startDate,
        dueDate: loans.dueDate,
        lastInterestCalcDate: loans.lastInterestCalcDate,
        note: loans.note,
      })
      .from(loans)
      .innerJoin(users, eq(loans.userId, users.id))
      .orderBy(loans.createdAt);

    // Fetch payment events to append payment history
    const allPayments = await db
      .select({
        id: payments.id,
        loanId: payments.loanId,
        paymentDate: payments.paymentDate,
        amountPaid: payments.amountPaid,
        interestPortion: payments.interestPortion,
        principalPortion: payments.principalPortion,
        remainingPrincipal: payments.remainingPrincipal,
      })
      .from(payments)
      .orderBy(payments.paymentDate);

    // Create a mapping of payments by loan ID
    const paymentsMap: Record<string, typeof allPayments> = {};
    for (const payment of allPayments) {
      if (!paymentsMap[payment.loanId]) {
        paymentsMap[payment.loanId] = [];
      }
      paymentsMap[payment.loanId].push(payment);
    }

    // Flatten data for Pivot table analysis: one row per loan (with aggregated payment counts & last payment info)
    const rawDataRows = rawData.map((loan) => {
      const loanPayments = paymentsMap[loan.loanId] || [];
      const paymentCount = loanPayments.length;
      const lastPayment = loanPayments[loanPayments.length - 1];

      return {
        'ID สัญญา': loan.loanId,
        'ชื่อผู้กู้': loan.debtorName ?? 'ไม่ระบุ',
        'เบอร์โทรศัพท์': loan.debtorPhone ?? 'ไม่ระบุ',
        'อีเมล': loan.debtorEmail ?? 'ไม่ระบุ',
        'LINE User ID': loan.debtorLineId ?? 'ไม่ระบุ',
        'วงเงินต้นสัญญา (บาท)': new Decimal(loan.principal).toNumber(),
        'เงินต้นคงเหลือ (บาท)': new Decimal(loan.outstandingPrincipal).toNumber(),
        'ดอกเบี้ยค้างสะสม (บาท)': new Decimal(loan.accruedInterest).toNumber(),
        'ดอกเบี้ยสะสมที่เก็บได้ (บาท)': new Decimal(loan.totalInterestCollected).toNumber(),
        'อัตราดอกเบี้ย (%)': new Decimal(loan.interestRate).toNumber(),
        'ประเภทดอกเบี้ย': formatInterestType(loan.interestType),
        'สถานะสัญญา': formatStatus(loan.status),
        'วันที่เริ่มสัญญา': loan.startDate,
        'วันที่ครบกำหนด': loan.dueDate,
        'คำนวณดอกเบี้ยล่าสุดเมื่อ': loan.lastInterestCalcDate ?? loan.startDate,
        'จำนวนครั้งที่ชำระ': paymentCount,
        'วันที่ชำระล่าสุด': lastPayment ? lastPayment.paymentDate : 'ยังไม่มีการชำระ',
        'ยอดชำระล่าสุด (บาท)': lastPayment ? new Decimal(lastPayment.amountPaid).toNumber() : 0,
        'หมายเหตุ': loan.note ?? '-',
      };
    });

    return NextResponse.json({
      summary: summaryData,
      rawRows: rawDataRows,
    });

  } catch (error: any) {
    console.error('[Export API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// ─── Helpers to translate codes to Thai for Excel report readability ──────────

function formatInterestType(type: string): string {
  switch (type) {
    case 'flat_daily':
      return 'คงที่รายวัน (Flat Daily)';
    case 'flat_monthly':
      return 'คงที่รายเดือน (Flat Monthly)';
    case 'effective_daily':
      return 'ลดต้นลดดอกรายวัน (Effective Daily)';
    case 'effective_monthly':
      return 'ลดต้นลดดอกรายเดือน (Effective Monthly)';
    default:
      return type;
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case 'active':
      return 'ปกติ (Active)';
    case 'upcoming':
      return 'ใกล้ครบกำหนด (Upcoming)';
    case 'overdue':
      return 'เกินกำหนดชำระ (Overdue)';
    case 'closed':
      return 'ปิดสัญญาแล้ว (Closed)';
    case 'npl':
      return 'หนี้เสีย (NPL)';
    default:
      return status;
  }
}
