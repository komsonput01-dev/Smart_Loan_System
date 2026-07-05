/**
 * Payment Allocator — ระบบตัดยอดอัจฉริยะ
 *
 * กฎการตัดยอด:
 * 1. นำเงินที่ชำระหัก "ดอกเบี้ยสะสมค้างชำระ" ให้หมดก่อน
 * 2. เศษเงินที่เหลือนำไปหัก "เงินต้นคงเหลือ"
 * 3. ถ้าเงินชำระน้อยกว่าดอกเบี้ยค้าง → ตัดดอกเบี้ยบางส่วน เงินต้นไม่ลด
 *
 * CRITICAL: ใช้ Decimal.js ทุกขั้นตอน ห้ามใช้ Number
 */

import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface AllocatePaymentParams {
  amountPaid: Decimal;
  accruedInterest: Decimal;      // ดอกเบี้ยสะสมทั้งหมด ณ วันที่ชำระ
  outstandingPrincipal: Decimal; // เงินต้นคงเหลือก่อนชำระ
}

export interface PaymentAllocation {
  amountPaid: Decimal;
  interestPortion: Decimal;      // ส่วนที่หักดอกเบี้ย
  principalPortion: Decimal;     // ส่วนที่หักเงินต้น
  remainingInterest: Decimal;    // ดอกเบี้ยค้างหลังชำระ
  remainingPrincipal: Decimal;   // เงินต้นคงเหลือหลังชำระ
  overpayment: Decimal;          // เงินเกิน (ถ้ามี)
}

/**
 * ตัดยอดเงินชำระ: ดอกเบี้ยก่อน → เงินต้น
 */
export function allocatePayment({
  amountPaid,
  accruedInterest,
  outstandingPrincipal,
}: AllocatePaymentParams): PaymentAllocation {
  // Validate inputs
  if (amountPaid.isNegative()) {
    throw new Error('Payment amount cannot be negative');
  }
  if (outstandingPrincipal.isNegative()) {
    throw new Error('Outstanding principal cannot be negative');
  }

  let remaining = amountPaid;

  // ── Step 1: ตัดดอกเบี้ยก่อน ──────────────────────────────────────────────
  const interestPortion = Decimal.min(remaining, accruedInterest);
  const remainingInterest = accruedInterest.minus(interestPortion);
  remaining = remaining.minus(interestPortion);

  // ── Step 2: ตัดเงินต้น ───────────────────────────────────────────────────
  const principalPortion = Decimal.min(remaining, outstandingPrincipal);
  const remainingPrincipal = outstandingPrincipal.minus(principalPortion);
  remaining = remaining.minus(principalPortion);

  // ── Step 3: เงินเกิน (overpayment) ─────────────────────────────────────
  const overpayment = remaining; // ถ้า > 0 แสดงว่าจ่ายเกิน

  return {
    amountPaid: amountPaid.toDecimalPlaces(2),
    interestPortion: interestPortion.toDecimalPlaces(2),
    principalPortion: principalPortion.toDecimalPlaces(2),
    remainingInterest: remainingInterest.toDecimalPlaces(2),
    remainingPrincipal: remainingPrincipal.toDecimalPlaces(2),
    overpayment: overpayment.toDecimalPlaces(2),
  };
}

/**
 * คำนวณยอดชำระขั้นต่ำ (ดอกเบี้ยสะสม + เงินต้นส่วนหนึ่ง)
 * ใช้สำหรับแสดง "ยอดชำระขั้นต่ำ" ในหน้า Dashboard
 */
export function calculateMinimumPayment({
  accruedInterest,
  outstandingPrincipal,
  minimumPrincipalRatio = new Decimal('0.01'), // default: ชำระเงินต้นขั้นต่ำ 1%
}: {
  accruedInterest: Decimal;
  outstandingPrincipal: Decimal;
  minimumPrincipalRatio?: Decimal;
}): Decimal {
  const minPrincipal = outstandingPrincipal.mul(minimumPrincipalRatio);
  return accruedInterest.plus(minPrincipal).toDecimalPlaces(2);
}

/**
 * คำนวณ Total Amount to Close (ปิดสัญญา)
 */
export function calculatePayoffAmount({
  accruedInterest,
  outstandingPrincipal,
}: {
  accruedInterest: Decimal;
  outstandingPrincipal: Decimal;
}): Decimal {
  return accruedInterest.plus(outstandingPrincipal).toDecimalPlaces(2);
}
