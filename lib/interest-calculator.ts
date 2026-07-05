/**
 * Interest Calculator — Dual-Engine
 *
 * รองรับ 4 รูปแบบการคิดดอกเบี้ย:
 * 1. flat_daily    — คงที่/วัน (จากเงินต้นก้อนแรก)
 * 2. flat_monthly  — คงที่/เดือน (จากเงินต้นก้อนแรก)
 * 3. effective_daily   — ลดต้นลดดอก/วัน (จากเงินต้นคงเหลือ)
 * 4. effective_monthly — ลดต้นลดดอก/เดือน (จากเงินต้นคงเหลือ)
 *
 * CRITICAL: ใช้ decimal.js สำหรับทุกการคำนวณ
 * ห้ามใช้ JavaScript Number ใน financial calculations
 */

import Decimal from 'decimal.js';
import dayjs from 'dayjs';

// Configure precision: 20 significant digits, round half-up (ปัดขึ้น)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type InterestType =
  | 'flat_daily'
  | 'flat_monthly'
  | 'effective_daily'
  | 'effective_monthly';

interface CalculateAccruedInterestParams {
  outstandingPrincipal: Decimal; // เงินต้นคงเหลือ (สำหรับ effective rate)
  originalPrincipal: Decimal;    // เงินต้นก้อนแรก (สำหรับ flat rate)
  interestRate: Decimal;         // อัตราดอกเบี้ย เช่น 3.0000 = 3%
  interestType: InterestType;
  fromDate: Date;                // วันที่คำนวณล่าสุด (หรือ startDate)
  toDate: Date;                  // วันที่ชำระ (หรือวันปัจจุบัน)
}

/**
 * คำนวณดอกเบี้ยสะสมระหว่างช่วงวันที่
 * Returns: Decimal ของดอกเบี้ยสะสม (ยังไม่ได้รวมกับค้างก่อนหน้า)
 */
export function calculateAccruedInterest({
  outstandingPrincipal,
  originalPrincipal,
  interestRate,
  interestType,
  fromDate,
  toDate,
}: CalculateAccruedInterestParams): Decimal {
  // ป้องกัน negative days (ไม่ควรเกิดขึ้น แต่ defensive coding)
  const days = daysBetween(fromDate, toDate);
  if (days <= 0) return new Decimal(0);

  const rate = interestRate.div(100); // แปลง % เป็น decimal (3% → 0.03)

  switch (interestType) {
    // ── Flat Rate (คงที่) — คิดจากเงินต้นก้อนแรกเสมอ ────────────────────────
    case 'flat_daily': {
      // ดอกเบี้ย = เงินต้นเดิม × (rate / 365) × จำนวนวัน
      return originalPrincipal
        .mul(rate)
        .div(365)
        .mul(days)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    case 'flat_monthly': {
      // ดอกเบี้ย = เงินต้นเดิม × (rate / 12) × จำนวนเดือนจริงตามปฏิทิน (Calendar Months)
      const months = new Decimal(dayjs(toDate).diff(dayjs(fromDate), 'month', true));
      return originalPrincipal
        .mul(rate)
        .div(12)
        .mul(months)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    // ── Effective Rate (ลดต้นลดดอก) — คิดจากเงินต้นคงเหลือ ─────────────────
    case 'effective_daily': {
      // ดอกเบี้ย = เงินต้นคงเหลือ × (rate / 365) × จำนวนวัน
      return outstandingPrincipal
        .mul(rate)
        .div(365)
        .mul(days)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    case 'effective_monthly': {
      // ดอกเบี้ย = เงินต้นคงเหลือ × (rate / 12) × จำนวนเดือนจริงตามปฏิทิน (Calendar Months)
      const months = new Decimal(dayjs(toDate).diff(dayjs(fromDate), 'month', true));
      return outstandingPrincipal
        .mul(rate)
        .div(12)
        .mul(months)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    default: {
      throw new Error(`Unknown interest type: ${interestType}`);
    }
  }
}

/**
 * คำนวณดอกเบี้ยรายวัน (1 วัน) สำหรับแสดงผลในหน้า Dashboard
 */
export function calculateDailyInterest({
  outstandingPrincipal,
  originalPrincipal,
  interestRate,
  interestType,
}: Omit<CalculateAccruedInterestParams, 'fromDate' | 'toDate'>): Decimal {
  // สร้างวันปัจจุบันและวันพรุ่งนี้ในเขตเวลาประเทศไทย (ICT)
  const todayStr = dayjs().add(7, 'hour').format('YYYY-MM-DD');
  const tomorrowStr = dayjs().add(7, 'hour').add(1, 'day').format('YYYY-MM-DD');
  const today = new Date(todayStr);
  const tomorrow = new Date(tomorrowStr);

  return calculateAccruedInterest({
    outstandingPrincipal,
    originalPrincipal,
    interestRate,
    interestType,
    fromDate: today,
    toDate: tomorrow,
  });
}

/**
 * คำนวณจำนวนวันระหว่างสองวันที่ (ไม่นับวันเริ่มต้น, นับวันสุดท้าย)
 */
export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  // Normalize to midnight UTC to avoid DST issues
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / msPerDay);
}

/**
 * คำนวณดอกเบี้ยสะสม ณ วันนี้ สำหรับแสดงในหน้า Dashboard
 * (ใช้สำหรับ real-time display ก่อนมีการชำระ)
 */
export function calculateCurrentAccruedInterest(params: {
  outstandingPrincipal: string; // NUMERIC จาก DB (string)
  originalPrincipal: string;
  interestRate: string;
  interestType: InterestType;
  lastInterestCalcDate: string | null;
  startDate: string;
  existingAccruedInterest: string; // ดอกเบี้ยค้างที่บันทึกไว้แล้ว
}): Decimal {
  const lastCalc = params.lastInterestCalcDate ?? params.startDate;
  const fromDate = new Date(lastCalc);
  
  // แปลงเวลาเซิร์ฟเวอร์เป็นวันที่ของประเทศไทย (ICT / UTC+7) เพื่อป้องกันเศษวันเบี้ยว
  const toDateStr = dayjs().add(7, 'hour').format('YYYY-MM-DD');
  const toDate = new Date(toDateStr);

  const newInterest = calculateAccruedInterest({
    outstandingPrincipal: new Decimal(params.outstandingPrincipal),
    originalPrincipal: new Decimal(params.originalPrincipal),
    interestRate: new Decimal(params.interestRate),
    interestType: params.interestType,
    fromDate,
    toDate,
  });

  return new Decimal(params.existingAccruedInterest)
    .plus(newInterest)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
