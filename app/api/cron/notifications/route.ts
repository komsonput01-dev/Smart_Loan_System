/**
 * LINE Notification Cron Job & Queue Processor
 *
 * Route: GET /api/cron/notifications
 * Scheduled at: 08:30 ICT (01:30 UTC) daily
 *
 * Security: Checks for Bearer token in Authorization header
 * Queue architecture:
 *   1. Enqueue: Scan loans for T-3, T-1, and Overdue conditions and insert pending jobs
 *   2. Process: Retrieve pending notifications and send via LINE Messaging API
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loans, users, lineNotifications, notificationLogs } from '@/lib/db/schema';
import { eq, and, lte, lt, sql, notInArray } from 'drizzle-orm';
import dayjs from 'dayjs';
import Decimal from 'decimal.js';
import { sendLinePushMessage } from '@/lib/line-notify';
import { calculateCurrentAccruedInterest } from '@/lib/interest-calculator';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export async function GET(req: Request) {
  try {
    // ── 1. Security Check ────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Reject if CRON_SECRET is configured but token doesn't match
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Cron Notifications] Unauthorized trigger attempt blocked.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayStr = dayjs().format('YYYY-MM-DD');
    const t3DateStr = dayjs().add(3, 'day').format('YYYY-MM-DD');
    const t1DateStr = dayjs().add(1, 'day').format('YYYY-MM-DD');

    console.log(`[Cron Notifications] Starting cron execution for ${todayStr}`);

    // ── 2. Enqueue Phase: T-3 (Upcoming in 3 Days) ───────────────────────────
    const t3Loans = await db
      .select({
        id: loans.id,
        principal: loans.principal,
        dueDate: loans.dueDate,
        lineUserId: users.lineUserId,
        userName: users.fullName,
      })
      .from(loans)
      .innerJoin(users, eq(loans.userId, users.id))
      .where(
        and(
          eq(loans.dueDate, t3DateStr),
          eq(loans.status, 'active'),
          sql`${users.lineUserId} IS NOT NULL`
        )
      );

    let enqueuedCount = 0;

    for (const loan of t3Loans) {
      if (!loan.lineUserId) continue;

      // Check if we already enqueued T-3 for this loan today
      const alreadyEnqueued = await db
        .select()
        .from(lineNotifications)
        .where(
          and(
            eq(lineNotifications.loanId, loan.id),
            sql`DATE(${lineNotifications.createdAt}) = CURRENT_DATE`,
            sql`${lineNotifications.messageText} LIKE '%ครบกำหนดชำระในอีก 3 วัน%'`
          )
        )
        .limit(1);

      if (alreadyEnqueued.length > 0) continue;

      const messageText = [
        `สวัสดีคุณ ${loan.userName},`,
        '',
        `🔔 แจ้งเตือนสัญญาเงินกู้ #${loan.id} ของคุณใกล้ครบกำหนดชำระในอีก 3 วัน (วันที่ ${dayjs(loan.dueDate).format('DD/MM/YYYY')}) กรุณาเตรียมชำระยอดตามสัญญาด้วยค่ะ`
      ].join('\n');

      await db.insert(lineNotifications).values({
        loanId: loan.id,
        lineUserId: loan.lineUserId,
        messageText,
        status: 'pending',
      });
      enqueuedCount = new Decimal(enqueuedCount).plus(1).toNumber();
    }

    // ── 3. Enqueue Phase: T-1 (Upcoming in 1 Day with Bank Info) ─────────────
    const t1Loans = await db
      .select({
        id: loans.id,
        principal: loans.principal,
        outstandingPrincipal: loans.outstandingPrincipal,
        accruedInterest: loans.accruedInterest,
        interestRate: loans.interestRate,
        interestType: loans.interestType,
        lastInterestCalcDate: loans.lastInterestCalcDate,
        startDate: loans.startDate,
        dueDate: loans.dueDate,
        lineUserId: users.lineUserId,
        userName: users.fullName,
        bankName: loans.bankName,
        bankAccountNumber: loans.bankAccountNumber,
        bankAccountName: loans.bankAccountName,
      })
      .from(loans)
      .innerJoin(users, eq(loans.userId, users.id))
      .where(
        and(
          eq(loans.dueDate, t1DateStr),
          eq(loans.status, 'active'),
          sql`${users.lineUserId} IS NOT NULL`
        )
      );

    for (const loan of t1Loans) {
      if (!loan.lineUserId) continue;

      // Check if we already enqueued T-1 for this loan today
      const alreadyEnqueued = await db
        .select()
        .from(lineNotifications)
        .where(
          and(
            eq(lineNotifications.loanId, loan.id),
            sql`DATE(${lineNotifications.createdAt}) = CURRENT_DATE`,
            sql`${lineNotifications.messageText} LIKE '%ครบกำหนดชำระในวันพรุ่งนี้%'`
          )
        )
        .limit(1);

      if (alreadyEnqueued.length > 0) continue;

      // Calculate total accrued interest including today
      const currentAccruedResult = calculateCurrentAccruedInterest({
        outstandingPrincipal: loan.outstandingPrincipal,
        originalPrincipal: loan.principal,
        interestRate: loan.interestRate,
        interestType: loan.interestType,
        lastInterestCalcDate: loan.lastInterestCalcDate,
        startDate: loan.startDate,
        existingAccruedInterest: loan.accruedInterest,
        dueDate: loan.dueDate,
      });
      const currentAccrued = currentAccruedResult.totalAccrued;

      const totalPayoff = new Decimal(loan.outstandingPrincipal).plus(currentAccrued);

      // Bank account defaults if not set on the contract
      const bankName = loan.bankName ?? process.env.BANK_NAME ?? 'ธนาคารกสิกรไทย';
      const bankAccountNum = loan.bankAccountNumber ?? process.env.BANK_ACCOUNT_NUMBER ?? 'xxx-x-xxxxx-x';
      const bankAccountName = loan.bankAccountName ?? process.env.BANK_ACCOUNT_NAME ?? 'บริษัท สมาร์ทโลน จำกัด';

      const messageText = [
        `สวัสดีคุณ ${loan.userName},`,
        '',
        `📅 แจ้งเตือนครบกำหนดชำระในวันพรุ่งนี้ (วันที่ ${dayjs(loan.dueDate).format('DD/MM/YYYY')})`,
        '',
        `💵 ยอดเงินต้นคงเหลือ: ฿${new Decimal(loan.outstandingPrincipal).toNumber().toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        `📈 ดอกเบี้ยสะสม: ฿${currentAccrued.toNumber().toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        `💰 รวมยอดต้องชำระ: ฿${totalPayoff.toNumber().toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        '',
        `🏦 ช่องทางชำระเงิน:`,
        `ธนาคาร: ${bankName}`,
        `เลขที่บัญชี: ${bankAccountNum}`,
        `ชื่อบัญชี: ${bankAccountName}`,
        '',
        'กรุณาชำระเงินและส่งรูปหลักฐานสลิปการโอนผ่านทางแชทนี้ได้เลยค่ะ'
      ].join('\n');

      await db.insert(lineNotifications).values({
        loanId: loan.id,
        lineUserId: loan.lineUserId,
        messageText,
        status: 'pending',
      });
      enqueuedCount = new Decimal(enqueuedCount).plus(1).toNumber();
    }

    // ── 4. Enqueue Phase: Overdue ────────────────────────────────────────────
    const overdueLoans = await db
      .select({
        id: loans.id,
        principal: loans.principal,
        outstandingPrincipal: loans.outstandingPrincipal,
        accruedInterest: loans.accruedInterest,
        interestRate: loans.interestRate,
        interestType: loans.interestType,
        lastInterestCalcDate: loans.lastInterestCalcDate,
        startDate: loans.startDate,
        dueDate: loans.dueDate,
        lineUserId: users.lineUserId,
        userName: users.fullName,
      })
      .from(loans)
      .innerJoin(users, eq(loans.userId, users.id))
      .where(
        and(
          lt(loans.dueDate, todayStr),
          sql`${loans.status} IN ('active', 'upcoming', 'overdue')`,
          sql`${users.lineUserId} IS NOT NULL`
        )
      );

    for (const loan of overdueLoans) {
      if (!loan.lineUserId) continue;

      // Check if we already enqueued Overdue notification for this loan today
      const alreadyEnqueued = await db
        .select()
        .from(lineNotifications)
        .where(
          and(
            eq(lineNotifications.loanId, loan.id),
            sql`DATE(${lineNotifications.createdAt}) = CURRENT_DATE`,
            sql`${lineNotifications.messageText} LIKE '%เกินกำหนดชำระ%'`
          )
        )
        .limit(1);

      if (alreadyEnqueued.length > 0) continue;

      const currentAccruedResult = calculateCurrentAccruedInterest({
        outstandingPrincipal: loan.outstandingPrincipal,
        originalPrincipal: loan.principal,
        interestRate: loan.interestRate,
        interestType: loan.interestType,
        lastInterestCalcDate: loan.lastInterestCalcDate,
        startDate: loan.startDate,
        existingAccruedInterest: loan.accruedInterest,
        dueDate: loan.dueDate,
      });
      const currentAccrued = currentAccruedResult.totalAccrued;

      const totalPayoff = new Decimal(loan.outstandingPrincipal).plus(currentAccrued);
      const msPerDay = 1000 * 60 * 60 * 24;
      const overdueDays = Math.max(
        1,
        Math.floor(
          new Decimal(new Date().getTime()).minus(new Date(loan.dueDate).getTime()).div(msPerDay).toNumber()
        )
      );

      const messageText = [
        `⚠️ แจ้งเตือนด่วนคุณ ${loan.userName},`,
        '',
        `🔴 สัญญาเงินกู้ #${loan.id} ของคุณ เกินกำหนดชำระมาแล้ว ${overdueDays} วัน`,
        '',
        `💵 ยอดเงินต้นคงเหลือค้าง: ฿${new Decimal(loan.outstandingPrincipal).toNumber().toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        `📈 ดอกเบี้ยสะสมค้าง: ฿${currentAccrued.toNumber().toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        `💰 รวมยอดค้างชำระสุทธิ: ฿${totalPayoff.toNumber().toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        '',
        'กรุณาชำระยอดและติดต่อเจ้าหน้าที่ทันทีเพื่อป้องกันการระงับสัญญาหรือบันทึกประวัติชำระเงินค้างค่ะ'
      ].join('\n');

      await db.insert(lineNotifications).values({
        loanId: loan.id,
        lineUserId: loan.lineUserId,
        messageText,
        status: 'pending',
      });

      // Also update the loan status to overdue in the DB
      await db
        .update(loans)
        .set({ status: 'overdue', updatedAt: new Date() })
        .where(eq(loans.id, loan.id));

      enqueuedCount = new Decimal(enqueuedCount).plus(1).toNumber();
    }

    console.log(`[Cron Notifications] Enqueued ${enqueuedCount} notifications in pending state.`);

    // ── 5. Processing Phase (Worker) ────────────────────────────────────────
    // Retrieve all pending queue items, limited to batch size of 15 to prevent timeouts
    const batchSize = 15;
    const pendingQueue = await db
      .select()
      .from(lineNotifications)
      .where(eq(lineNotifications.status, 'pending'))
      .limit(batchSize);

    const results = await Promise.all(
      pendingQueue.map(async (notification) => {
        const result = await sendLinePushMessage(
          notification.lineUserId,
          notification.messageText
        );

        let type = 'overdue';
        if (notification.messageText.includes('ครบกำหนดชำระในอีก 3 วัน')) {
          type = 't-3';
        } else if (notification.messageText.includes('ครบกำหนดชำระในวันพรุ่งนี้')) {
          type = 't-1';
        }

        if (result.success) {
          await db
            .update(lineNotifications)
            .set({
              status: 'sent',
              sentAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(lineNotifications.id, notification.id));

          await db.insert(notificationLogs).values({
            loanId: notification.loanId,
            notificationType: type,
            sentDate: todayStr,
            success: true,
          });

          return { success: true };
        } else {
          await db
            .update(lineNotifications)
            .set({
              status: 'failed',
              errorMessage: result.error ?? 'Unknown transmission error',
              updatedAt: new Date(),
            })
            .where(eq(lineNotifications.id, notification.id));

          await db.insert(notificationLogs).values({
            loanId: notification.loanId,
            notificationType: type,
            sentDate: todayStr,
            success: false,
            errorMessage: result.error,
          });

          return { success: false };
        }
      })
    );

    const sentCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    console.log(`[Cron Notifications] Completed processing. Sent: ${sentCount}, Failed: ${failedCount}`);

    return NextResponse.json({
      success: true,
      processed: {
        enqueued: enqueuedCount,
        sent: sentCount,
        failed: failedCount,
      },
    });

  } catch (error: any) {
    console.error('[Cron Notifications Route Error]', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
