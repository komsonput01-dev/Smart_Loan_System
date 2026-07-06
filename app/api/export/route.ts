/**
 * Export API Route — Smart Loan Management System
 *
 * Route: GET /api/export
 * Retrieves aggregated financial metrics for 'Summary' tab
 * and granular loan/payment records for 'Raw_Data' tab.
 *
 * Financial calculations are performed using decimal.js to guarantee precision.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loans, users, payments } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { ensureUser } from '@/lib/db/ensureUser';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export async function GET() {
  try {
    const currentUser = await ensureUser();
    if (!currentUser) {
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
        penaltyPortion: payments.penaltyPortion,
        interestPortion: payments.interestPortion,
        principalPortion: payments.principalPortion,
        remainingPrincipal: payments.remainingPrincipal,
      })
      .from(payments)
      .orderBy(payments.paymentDate);

    // ── 3. Compute real-time interest and prepare raw rows ─────────────
    const { calculateCurrentAccruedInterest } = await import('@/lib/interest-calculator');
    const rawRows = rawData.map((loanRow) => {
      const loanPayments = allPayments.filter((p) => p.loanId === loanRow.loanId);
      const totalAmountPaid = loanPayments.reduce(
        (sum, p) => sum.plus(new Decimal(p.amountPaid)),
        new Decimal('0')
      );

      const currentInterest = calculateCurrentAccruedInterest({
        outstandingPrincipal: loanRow.outstandingPrincipal,
        originalPrincipal: loanRow.principal,
        interestRate: loanRow.interestRate,
        interestType: loanRow.interestType as any,
        lastInterestCalcDate: loanRow.lastInterestCalcDate,
        startDate: loanRow.startDate,
        existingAccruedInterest: loanRow.accruedInterest,
        dueDate: loanRow.dueDate,
      });

      return {
        'รหัสสัญญา': loanRow.note?.replace('รหัสสัญญา: ', '') || loanRow.loanId.substring(0, 8),
        'ชื่อลูกหนี้': loanRow.debtorName || '—',
        'เบอร์โทรศัพท์': loanRow.debtorPhone || '—',
        'อีเมล': loanRow.debtorEmail || '—',
        'LINE User ID': loanRow.debtorLineId || '—',
        'เงินต้นเริ่มแรก': Number(loanRow.principal),
        'เงินต้นคงเหลือ': Number(loanRow.outstandingPrincipal),
        'ดอกเบี้ยค้างจ่ายสะสม (ฐานข้อมูล)': Number(loanRow.accruedInterest),
        'ดอกเบี้ยปกติค้างชำระ ณ ปัจจุบัน': currentInterest.normalAccrued.toNumber(),
        'เบี้ยปรับค้างชำระ ณ ปัจจุบัน': currentInterest.penaltyAccrued.toNumber(),
        'รวมดอกเบี้ยที่เก็บได้': Number(loanRow.totalInterestCollected),
        'ยอดชำระคืนรวม': totalAmountPaid.toNumber(),
        'อัตราดอกเบี้ย (%)': Number(loanRow.interestRate),
        'เงื่อนไขดอกเบี้ย': loanRow.interestType,
        'สถานะสัญญา': loanRow.status,
        'วันที่เริ่มสัญญา': loanRow.startDate,
        'วันที่สิ้นสุดสัญญา': loanRow.dueDate,
        'วันที่คิดดอกเบี้ยล่าสุด': loanRow.lastInterestCalcDate || '—',
      };
    // ── 4. Prepare Payment Data (Payment_History) ─────────────
    const paymentRows = allPayments.map((p) => {
      // Find associated loan to get debtor name
      const loan = rawData.find((l) => l.loanId === p.loanId);
      return {
        'วันที่บันทึกชำระ': p.paymentDate,
        'ชื่อลูกหนี้': loan?.debtorName || '—',
        'รหัสสัญญา': loan?.note?.replace('รหัสสัญญา: ', '') || p.loanId.substring(0, 8),
        'ยอดชำระทั้งหมด': Number(p.amountPaid),
        'ตัดชำระดอกเบี้ยปรับ': Number((p as any).penaltyPortion || 0),
        'ตัดชำระดอกเบี้ยปกติ': Number(p.interestPortion),
        'ตัดชำระเงินต้น': Number(p.principalPortion),
        'เงินต้นคงเหลือ': Number(p.remainingPrincipal),
      };
    });

    return NextResponse.json({
      summary: summaryData,
      rawRows,
      paymentRows,
    });
  } catch (error) {
    console.error('[GET /api/export]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
