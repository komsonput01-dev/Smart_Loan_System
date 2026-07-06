/**
 * LINE Bot Webhook API — Automatically links LINE User ID to debtor account
 *
 * POST /api/webhooks/line
 *
 * Workflow:
 * 1. Debtor adds LINE Bot and sends their registered email or phone number.
 * 2. Webhook catches the message, searches for the debtor in the database.
 * 3. If found, automatically saves the LINE User ID to their database user record.
 * 4. Bot replies confirming the account link.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, or, and } from 'drizzle-orm';
import crypto from 'crypto';

// Helper to reply to LINE message
async function replyToLine(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || token === 'placeholder') return;

  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text }],
      }),
    });
  } catch (error) {
    console.error('[LINE Webhook] Failed to send reply:', error);
  }
}

// Verify LINE Signature to prevent spoofing
function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return true; // Skip verification if secret not configured yet
  if (!signature) return false;

  const hash = crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');

  return hash === signature;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-line-signature');

    // 🔒 Security check
    if (!verifySignature(rawBody, signature)) {
      return new Response('Invalid signature', { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const events = body.events ?? [];

    for (const event of events) {
      // Process only text messages from users
      if (event.type === 'message' && event.message?.type === 'text') {
        const replyToken = event.replyToken;
        const lineUserId = event.source?.userId;
        const inputText = event.message.text.trim();

        if (!lineUserId || !replyToken) continue;

        // Check if this lineUserId is already linked to an active user
        const alreadyLinked = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.lineUserId, lineUserId))
          .limit(1);

        if (alreadyLinked.length > 0) {
          // User is already linked. Ignore text messages so Admin can reply manually in LINE OA.
          continue;
        }

        // Try to match email or phone number in database
        const isEmail = inputText.includes('@');
        const searchTerm = isEmail ? inputText.toLowerCase() : inputText.replace(/-/g, '');

        // Search for active user
        const matchedUsers = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.isActive, true),
              or(
                eq(users.email, searchTerm),
                eq(users.phone, searchTerm)
              )
            )
          )
          .limit(1);

        if (matchedUsers.length > 0) {
          const matchedUser = matchedUsers[0];

          // Save lineUserId to user
          await db
            .update(users)
            .set({
              lineUserId,
              updatedAt: new Date(),
            })
            .where(eq(users.id, matchedUser.id));

          // Reply success message
          const successMsg = [
            `🎉 ผูกบัญชีสำเร็จเรียบร้อยแล้วค่ะ!`,
            `สวัสดีคุณ ${matchedUser.fullName}`,
            '',
            `ระบบได้เชื่อมต่อ LINE นี้กับบัญชีสัญญาเงินกู้ของคุณเรียบร้อยแล้ว ต่อจากนี้คุณจะได้รับบิลและแจ้งเตือนวันครบกำหนดชำระผ่านช่องทางไลน์นี้ค่ะ 😊`
          ].join('\n');

          await replyToLine(replyToken, successMsg);
        } else {
          // Reply not found message
          const failMsg = [
            `❌ ไม่พบข้อมูลในระบบกู้ยืม`,
            '',
            `ไม่พบอีเมลหรือเบอร์โทรศัพท์ "${inputText}" ในระบบ`,
            `กรุณาตรวจสอบและพิมพ์ส่ง "อีเมล" หรือ "เบอร์โทรศัพท์" ที่คุณใช้ในการลงทะเบียนขอเงินกู้ใหม่อีกครั้งเพื่อผูกบัญชีค่ะ`
          ].join('\n');

          await replyToLine(replyToken, failMsg);
        }
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[LINE Webhook Error]', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
