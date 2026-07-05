/**
 * Manual LINE Notification API — Send immediate LINE reminder to a debtor
 *
 * POST /api/loans/[id]/notify
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loans, users, lineNotifications, notificationLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ensureUser } from '@/lib/db/ensureUser';
import { sendLinePushMessage } from '@/lib/line-notify';
import { calculateCurrentAccruedInterest } from '@/lib/interest-calculator';
import Decimal from 'decimal.js';
import dayjs from 'dayjs';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const currentUser = await ensureUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    // Fetch loan and user data
    const loanData = await db
      .select({
        loan: loans,
        user: users,
      })
      .from(loans)
      .innerJoin(users, eq(loans.userId, users.id))
      .where(eq(loans.id, id))
      .limit(1);

    if (!loanData[0]) {
      return NextResponse.json({ error: 'Loan or user not found' }, { status: 404 });
    }

    const { loan, user } = loanData[0];

    if (!user.lineUserId) {
      return NextResponse.json(
        { error: 'ลูกหนี้รายนี้ยังไม่ได้ตั้งค่า LINE User ID ในระบบ ไม่สามารถส่งแจ้งเตือนได้' },
        { status: 400 }
      );
    }

    // Calculate real-time financial figures up to today
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

    const outstanding = new Decimal(loan.outstandingPrincipal);
    const normalAccrued = currentAccruedResult.normalAccrued;
    const penaltyAccrued = currentAccruedResult.penaltyAccrued;
    const totalPayoff = outstanding.plus(normalAccrued).plus(penaltyAccrued);

    // Format currency strings
    const fmt = (val: Decimal) =>
      `฿${val.toNumber().toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const bankName = loan.bankName ?? process.env.BANK_NAME ?? 'ธนาคารกสิกรไทย';
    const bankAccountNum = loan.bankAccountNumber ?? process.env.BANK_ACCOUNT_NUMBER ?? 'xxx-x-xxxxx-x';
    const bankAccountName = loan.bankAccountName ?? process.env.BANK_ACCOUNT_NAME ?? 'บริษัท สมาร์ทโลน จำกัด';

    const loanRef = loan.note?.replace('รหัสสัญญา: ', '') ?? loan.id.substring(0, 8);
    const isOverdue = loan.status === 'overdue' || loan.status === 'npl';

    let messageText = '';
    let notificationType = 'manual-reminder';

    if (isOverdue) {
      notificationType = 'manual-overdue';
      const msPerDay = 1000 * 60 * 60 * 24;
      const overdueDays = Math.max(
        1,
        Math.floor(
          new Decimal(new Date().getTime()).minus(new Date(loan.dueDate).getTime()).div(msPerDay).toNumber()
        )
      );

      messageText = [
        `⚠️ แจ้งเตือนยอดค้างชำระด่วน คุณ ${user.fullName},`,
        '',
        `🔴 สัญญาเงินกู้ #${loanRef} ของคุณ เกินกำหนดชำระมาแล้ว ${overdueDays} วัน`,
        '',
        `💵 เงินต้นคงค้าง: ${fmt(outstanding)}`,
        `📈 ดอกเบี้ยสะสม: ${fmt(normalAccrued)}`,
        `⚡ ดอกเบี้ยปรับค้างชำระ (15%/ปี): ${fmt(penaltyAccrued)}`,
        `💰 ยอดรวมปิดสัญญา: ${fmt(totalPayoff)}`,
        '',
        `🏦 ช่องทางชำระเงิน:`,
        `ธนาคาร: ${bankName}`,
        `เลขที่บัญชี: ${bankAccountNum}`,
        `ชื่อบัญชี: ${bankAccountName}`,
        '',
        `กรุณาชำระยอดค้างชำระทั้งหมดโดยด่วน และส่งสลิปหลักฐานผ่านแชทนี้เพื่อบันทึกประวัติการชำระเงินค่ะ`
      ].join('\n');
    } else {
      messageText = [
        `🔔 แจ้งเตือนยอดค้างชำระ คุณ ${user.fullName},`,
        '',
        `🟢 รายละเอียดสัญญาเงินกู้ #${loanRef}`,
        `📅 วันครบกำหนด: ${dayjs(loan.dueDate).format('DD/MM/YYYY')}`,
        '',
        `💵 เงินต้นคงค้าง: ${fmt(outstanding)}`,
        `📈 ดอกเบี้ยสะสม: ${fmt(normalAccrued)}`,
        `💰 ยอดชำระสุทธิ: ${fmt(totalPayoff)}`,
        '',
        `🏦 ช่องทางชำระเงิน:`,
        `ธนาคาร: ${bankName}`,
        `เลขที่บัญชี: ${bankAccountNum}`,
        `ชื่อบัญชี: ${bankAccountName}`,
        '',
        `กรุณาชำระเงินและส่งรูปสลิปหลักฐานการโอนผ่านทางแชทนี้ได้เลยค่ะ ขอบคุณค่ะ`
      ].join('\n');
    }

    // Insert pending LINE notification record
    const [lineNotification] = await db
      .insert(lineNotifications)
      .values({
        loanId: loan.id,
        lineUserId: user.lineUserId,
        messageText,
        status: 'pending',
      })
      .returning();

    // Send the message using LINE API
    const pushResult = await sendLinePushMessage(user.lineUserId, messageText);

    const todayStr = dayjs().format('YYYY-MM-DD');

    if (pushResult.success) {
      // Update LINE notification status to sent
      await db
        .update(lineNotifications)
        .set({
          status: 'sent',
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(lineNotifications.id, lineNotification.id));

      // Write into audit logs
      await db.insert(notificationLogs).values({
        loanId: loan.id,
        notificationType,
        sentDate: todayStr,
        success: true,
      });

      return NextResponse.json({ success: true, message: 'ส่งแจ้งเตือนทาง LINE สำเร็จแล้ว' });
    } else {
      // Update LINE notification status to failed
      await db
        .update(lineNotifications)
        .set({
          status: 'failed',
          errorMessage: pushResult.error ?? 'Transmission failed',
          updatedAt: new Date(),
        })
        .where(eq(lineNotifications.id, lineNotification.id));

      // Write into audit logs
      await db.insert(notificationLogs).values({
        loanId: loan.id,
        notificationType,
        sentDate: todayStr,
        success: false,
        errorMessage: pushResult.error,
      });

      return NextResponse.json(
        { error: `การส่งข้อความผ่าน LINE ล้มเหลว: ${pushResult.error}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[POST /api/loans/[id]/notify]', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
